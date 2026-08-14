import { useEffect, useRef, useState } from 'react'
import type { VoiceSettings } from '../../../shared/voice/voiceSettings'
import {
  createVoiceConnectionDiagnostics as createPeerMetrics,
  normalizeVoiceRtcStatsSample,
  resolveVoiceConnectionQualityState,
} from './voiceConnectionQualityModel'
import type {
  NormalizedVoiceRtcStatsSample,
  VoiceConnectionLifecycleSnapshot,
  VoiceConnectionMetrics,
  VoiceConnectionQualityState,
} from './voiceConnectionQualityModel'
import { voiceDebug } from './voiceChannelDebug'
import type {
  ConnectedVoiceChannel,
  VoiceConnectionDiagnostics,
  VoiceLifecycleState,
  VoicePeerConnectionDiagnostics,
} from './voiceChannelTypes'
import { resolveVoiceTransmissionQualityPlan } from './voiceTransmissionQualityModel'

const diagnosticsIntervalMs = 2_000
const peerStatsTimeoutMs = 1_500
const stalePeerDiagnosticsMs = 6_000

type PeerConnectionEntry = readonly [string, RTCPeerConnection]

type UseVoiceConnectionDiagnosticsOptions = {
  connectedChannel: ConnectedVoiceChannel | null
  connectionTargetChannel: ConnectedVoiceChannel | null
  lifecycleState: VoiceLifecycleState
  voiceSettings: Pick<VoiceSettings, 'qualityProfile' | 'adaptiveQuality'>
  getPeerConnection: (participantId: string) => RTCPeerConnection | null
  getPeerConnectionsSnapshot: () => PeerConnectionEntry[]
}

type VoicePeerMetadata = {
  codec: string | null
  route: string | null
}

export type VoiceQualityHysteresisState = {
  stableState: VoiceConnectionQualityState | null
  pendingState: VoiceConnectionQualityState | null
  pendingSamples: number
}

type StatsRecord = Record<string, unknown>

type PeerStatsResult = {
  participantId: string
  peer: RTCPeerConnection
  stats: RTCStatsReport
  capturedAtMs: number
}

type PeerStatsRequest = {
  promise: Promise<RTCStatsReport>
  isSettled: boolean
}

type LatestDiagnosticsOptions = Omit<
  UseVoiceConnectionDiagnosticsOptions,
  'connectedChannel' | 'connectionTargetChannel'
> & {
  isSwitchingConnectionTarget: boolean
}

type AudioBitrateRuntime = {
  appliedBySender: WeakMap<RTCRtpSender, number>
  desiredBySender: WeakMap<RTCRtpSender, number>
  taskBySender: WeakMap<RTCRtpSender, Promise<void>>
}

export function useVoiceConnectionDiagnostics({
  connectedChannel,
  connectionTargetChannel,
  lifecycleState,
  voiceSettings,
  getPeerConnection,
  getPeerConnectionsSnapshot,
}: UseVoiceConnectionDiagnosticsOptions) {
  const connectedChannelKey = connectedChannel
    ? `${connectedChannel.channelScope}:${connectedChannel.spaceId}`
    : null
  const connectionTargetChannelKey = connectionTargetChannel
    ? `${connectionTargetChannel.channelScope}:${connectionTargetChannel.spaceId}`
    : null
  const isSwitchingConnectionTarget =
    connectionTargetChannelKey !== null &&
    connectionTargetChannelKey !== connectedChannelKey
  const [connectionDiagnostics, setConnectionDiagnostics] =
    useState<VoiceConnectionDiagnostics | null>(null)
  const generationRef = useRef(0)
  const baselineByPeerRef = useRef(
    new WeakMap<RTCPeerConnection, NormalizedVoiceRtcStatsSample>(),
  )
  const latestDiagnosticsByPeerRef = useRef(
    new WeakMap<RTCPeerConnection, VoicePeerConnectionDiagnostics>(),
  )
  const appliedBitrateBySenderRef = useRef(
    new WeakMap<RTCRtpSender, number>(),
  )
  const desiredBitrateBySenderRef = useRef(
    new WeakMap<RTCRtpSender, number>(),
  )
  const bitrateTaskBySenderRef = useRef(
    new WeakMap<RTCRtpSender, Promise<void>>(),
  )
  const statsRequestByPeerRef = useRef(
    new WeakMap<RTCPeerConnection, PeerStatsRequest>(),
  )
  const latestOptionsRef = useRef<LatestDiagnosticsOptions>({
    lifecycleState,
    voiceSettings,
    getPeerConnection,
    getPeerConnectionsSnapshot,
    isSwitchingConnectionTarget,
  })
  const qualityHysteresisRef = useRef<VoiceQualityHysteresisState>(
    createVoiceQualityHysteresisState(),
  )
  const peerQualityHysteresisRef = useRef(
    new WeakMap<RTCPeerConnection, VoiceQualityHysteresisState>(),
  )

  useEffect(() => {
    latestOptionsRef.current = {
      lifecycleState,
      voiceSettings,
      getPeerConnection,
      getPeerConnectionsSnapshot,
      isSwitchingConnectionTarget,
    }
  }, [
    getPeerConnection,
    getPeerConnectionsSnapshot,
    isSwitchingConnectionTarget,
    lifecycleState,
    voiceSettings,
  ])

  useEffect(() => {
    qualityHysteresisRef.current = createVoiceQualityHysteresisState()
    peerQualityHysteresisRef.current = new WeakMap()
  }, [connectedChannelKey])

  useEffect(() => {
    setConnectionDiagnostics(() => {
      if (
        connectedChannelKey === null &&
        connectionTargetChannelKey === null &&
        lifecycleState === 'idle'
      ) {
        return null
      }

      const nextDiagnostics = isSwitchingConnectionTarget
        ? aggregateVoiceConnectionDiagnostics([], lifecycleState)
        : buildCurrentDiagnostics(
            latestOptionsRef.current,
            latestDiagnosticsByPeerRef.current,
            Date.now(),
          )
      const stabilized = stabilizeDiagnosticsQuality(
        nextDiagnostics,
        qualityHysteresisRef.current,
      )
      qualityHysteresisRef.current = stabilized.state
      return stabilized.diagnostics
    })
  }, [
    connectedChannelKey,
    connectionTargetChannelKey,
    isSwitchingConnectionTarget,
    lifecycleState,
  ])

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    baselineByPeerRef.current = new WeakMap()
    latestDiagnosticsByPeerRef.current = new WeakMap()
    statsRequestByPeerRef.current = new WeakMap()
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null
    let isRunning = false
    let isDisposed = false

    function isCurrentGeneration() {
      return !isDisposed && generationRef.current === generation
    }

    function clearScheduledPoll() {
      if (timeoutId === null) {
        return
      }

      window.clearTimeout(timeoutId)
      timeoutId = null
    }

    function schedulePoll(delayMs: number) {
      if (
        !isCurrentGeneration() ||
        isRunning ||
        isDocumentHidden()
      ) {
        return
      }

      clearScheduledPoll()
      timeoutId = window.setTimeout(() => {
        timeoutId = null
        void pollPeerConnections()
      }, delayMs)
    }

    async function pollPeerConnections() {
      if (
        !isCurrentGeneration() ||
        isRunning ||
        isDocumentHidden()
      ) {
        return
      }

      isRunning = true
      try {
        const options = latestOptionsRef.current
        const peerSnapshot = options.getPeerConnectionsSnapshot()
        const settledStats = await Promise.allSettled(
          peerSnapshot.map(async ([participantId, peer]) => ({
            participantId,
            peer,
            stats: await getPeerStatsWithTimeout(
              peer,
              statsRequestByPeerRef.current,
              peerStatsTimeoutMs,
            ),
            capturedAtMs: Date.now(),
          })),
        )

        if (
          !isCurrentGeneration() ||
          isDocumentHidden()
        ) {
          return
        }

        settledStats.forEach((result, index) => {
          if (result.status === 'rejected') {
            voiceDebug('diagnostics:peer-stats-failed', {
              participantId: peerSnapshot[index]?.[0] ?? null,
              message:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            })
            return
          }

          publishPeerStats(result.value, generation)
        })

        if (!isCurrentGeneration()) {
          return
        }

        const nextDiagnostics = latestOptionsRef.current
          .isSwitchingConnectionTarget
          ? aggregateVoiceConnectionDiagnostics(
              [],
              latestOptionsRef.current.lifecycleState,
            )
          : buildCurrentDiagnostics(
              latestOptionsRef.current,
              latestDiagnosticsByPeerRef.current,
              Date.now(),
            )
        const stabilized = stabilizeDiagnosticsQuality(
          nextDiagnostics,
          qualityHysteresisRef.current,
        )
        qualityHysteresisRef.current = stabilized.state
        const diagnostics = stabilized.diagnostics
        setConnectionDiagnostics(diagnostics)
      } finally {
        isRunning = false
        if (isCurrentGeneration()) {
          schedulePoll(diagnosticsIntervalMs)
        }
      }
    }

    function publishPeerStats(result: PeerStatsResult, resultGeneration: number) {
      if (
        generationRef.current !== resultGeneration ||
        latestOptionsRef.current.getPeerConnection(result.participantId) !==
          result.peer ||
        result.peer.signalingState === 'closed'
      ) {
        return
      }

      const currentSample = normalizeVoiceRtcStatsSample(
        result.stats,
        result.capturedAtMs,
      )
      const previousSample = baselineByPeerRef.current.get(result.peer) ?? null
      const metrics = createPeerMetrics(
        currentSample,
        previousSample,
        createPeerLifecycleSnapshot(result.peer),
      )
      const metadata = extractVoicePeerMetadata(result.stats)
      const qualityState =
        metrics.intervalMs === null && isMeasuredQuality(metrics.qualityState)
          ? 'unknown'
          : metrics.qualityState
      const qualityTransition = advanceVoiceQualityHysteresis(
        peerQualityHysteresisRef.current.get(result.peer) ??
          createVoiceQualityHysteresisState(),
        qualityState,
      )

      baselineByPeerRef.current.set(result.peer, currentSample)
      peerQualityHysteresisRef.current.set(
        result.peer,
        qualityTransition.state,
      )
      latestDiagnosticsByPeerRef.current.set(result.peer, {
        participantId: result.participantId,
        ...metrics,
        qualityState: qualityTransition.qualityState,
        connectionState: result.peer.connectionState,
        iceConnectionState: result.peer.iceConnectionState,
        codec: metadata.codec,
        route: metadata.route,
      })
    }

    function handleVisibilityChange() {
      if (isDocumentHidden()) {
        clearScheduledPoll()
        baselineByPeerRef.current = new WeakMap()
        return
      }

      schedulePoll(0)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (connectedChannelKey !== null) {
      schedulePoll(0)
    }

    return () => {
      isDisposed = true
      generationRef.current += 1
      clearScheduledPoll()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [connectedChannelKey])

  useEffect(() => {
    if (connectedChannelKey === null || isSwitchingConnectionTarget) {
      return
    }

    scheduleTransmissionBitrate(
      latestOptionsRef.current.getPeerConnectionsSnapshot(),
      connectionDiagnostics?.peersByParticipantId ?? {},
      latestOptionsRef.current.lifecycleState,
      latestOptionsRef.current.voiceSettings,
      createAudioBitrateRuntime(
        appliedBitrateBySenderRef.current,
        desiredBitrateBySenderRef.current,
        bitrateTaskBySenderRef.current,
      ),
    )
  }, [
    connectedChannelKey,
    connectionDiagnostics?.peersByParticipantId,
    isSwitchingConnectionTarget,
    voiceSettings.adaptiveQuality,
    voiceSettings.qualityProfile,
  ])

  return connectionDiagnostics
}

function stabilizeDiagnosticsQuality(
  diagnostics: VoiceConnectionDiagnostics | null,
  hysteresis: VoiceQualityHysteresisState,
) {
  if (diagnostics === null) {
    return { diagnostics, state: hysteresis }
  }

  const transition = advanceVoiceQualityHysteresis(
    hysteresis,
    diagnostics.qualityState,
  )
  return {
    diagnostics:
      transition.qualityState === diagnostics.qualityState
        ? diagnostics
        : { ...diagnostics, qualityState: transition.qualityState },
    state: transition.state,
  }
}

function createAudioBitrateRuntime(
  appliedBySender: WeakMap<RTCRtpSender, number>,
  desiredBySender: WeakMap<RTCRtpSender, number>,
  taskBySender: WeakMap<RTCRtpSender, Promise<void>>,
): AudioBitrateRuntime {
  return { appliedBySender, desiredBySender, taskBySender }
}

function scheduleTransmissionBitrate(
  peers: PeerConnectionEntry[],
  diagnosticsByParticipantId: Record<
    string,
    VoicePeerConnectionDiagnostics
  >,
  lifecycleState: VoiceLifecycleState,
  settings: Pick<VoiceSettings, 'qualityProfile' | 'adaptiveQuality'>,
  runtime: AudioBitrateRuntime,
) {
  const qualityByParticipantId = Object.fromEntries(
    peers.map(([participantId, peer]) => [
      participantId,
      diagnosticsByParticipantId[participantId]?.qualityState ??
        resolveVoiceConnectionQualityState({
          lifecycleState,
          connectionState: peer.connectionState,
          iceConnectionState: peer.iceConnectionState,
        }),
    ]),
  )
  const maxBitrateByParticipantId =
    resolveVoicePeerTransmissionMaxBitrates(
      qualityByParticipantId,
      settings,
    )

  for (const [participantId, peer] of peers) {
    if (peer.signalingState === 'closed') {
      continue
    }

    const maxBitrateBps = maxBitrateByParticipantId[participantId]
    if (maxBitrateBps === undefined) {
      continue
    }

    for (const sender of peer.getSenders()) {
      if (sender.track?.kind === 'audio') {
        enqueueAudioSenderBitrate(runtime, sender, maxBitrateBps)
      }
    }
  }
}

export function resolveVoicePeerTransmissionMaxBitrates(
  qualityByParticipantId: Readonly<
    Record<string, VoiceConnectionQualityState>
  >,
  settings: Pick<VoiceSettings, 'qualityProfile' | 'adaptiveQuality'>,
) {
  return Object.fromEntries(
    Object.entries(qualityByParticipantId).map(
      ([participantId, diagnosticsQualityState]) => [
        participantId,
        resolveVoiceTransmissionQualityPlan({
          qualityProfile: settings.qualityProfile,
          adaptiveQuality: settings.adaptiveQuality,
          diagnosticsQualityState,
        }).maxBitrateBps,
      ],
    ),
  )
}

function enqueueAudioSenderBitrate(
  runtime: AudioBitrateRuntime,
  sender: RTCRtpSender,
  maxBitrateBps: number,
) {
  runtime.desiredBySender.set(sender, maxBitrateBps)
  if (runtime.taskBySender.has(sender)) {
    return
  }

  const task = drainAudioSenderBitrateQueue(runtime, sender)
  runtime.taskBySender.set(sender, task)
  void task.then(
    () => finishAudioSenderBitrateTask(runtime, sender, task),
    () => finishAudioSenderBitrateTask(runtime, sender, task),
  )
}

async function drainAudioSenderBitrateQueue(
  runtime: AudioBitrateRuntime,
  sender: RTCRtpSender,
) {
  while (runtime.desiredBySender.has(sender)) {
    const maxBitrateBps = runtime.desiredBySender.get(sender)
    runtime.desiredBySender.delete(sender)
    if (
      maxBitrateBps === undefined ||
      runtime.appliedBySender.get(sender) === maxBitrateBps
    ) {
      continue
    }

    try {
      const didApply = await applyAudioSenderMaxBitrate(
        sender,
        maxBitrateBps,
      )
      if (didApply) {
        runtime.appliedBySender.set(sender, maxBitrateBps)
      }
    } catch (error) {
      voiceDebug('diagnostics:audio-bitrate-skipped', {
        maxBitrateBps,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export async function applyAudioSenderMaxBitrate(
  sender: Pick<RTCRtpSender, 'getParameters' | 'setParameters'>,
  maxBitrateBps: number,
) {
  const parameters = sender.getParameters()
  if (!parameters.encodings || parameters.encodings.length === 0) {
    return false
  }

  const [firstEncoding, ...remainingEncodings] = parameters.encodings
  parameters.encodings = [
    { ...firstEncoding, maxBitrate: maxBitrateBps },
    ...remainingEncodings,
  ]
  await sender.setParameters(parameters)
  return true
}

function finishAudioSenderBitrateTask(
  runtime: AudioBitrateRuntime,
  sender: RTCRtpSender,
  task: Promise<void>,
) {
  if (runtime.taskBySender.get(sender) !== task) {
    return
  }

  runtime.taskBySender.delete(sender)
  const nextBitrate = runtime.desiredBySender.get(sender)
  if (nextBitrate !== undefined) {
    enqueueAudioSenderBitrate(runtime, sender, nextBitrate)
  }
}

async function getPeerStatsWithTimeout(
  peer: RTCPeerConnection,
  requestsByPeer: WeakMap<RTCPeerConnection, PeerStatsRequest>,
  timeoutMs: number,
) {
  let request = requestsByPeer.get(peer)
  if (!request || request.isSettled) {
    request = {
      promise: peer.getStats(),
      isSettled: false,
    }
    requestsByPeer.set(peer, request)
    const currentRequest = request
    void currentRequest.promise.then(
      () => {
        currentRequest.isSettled = true
      },
      () => {
        currentRequest.isSettled = true
      },
    )
  }

  return settlePromiseWithin(request.promise, timeoutMs)
}

export function settlePromiseWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs} ms.`))
    }, timeoutMs)

    void promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function buildCurrentDiagnostics(
  options: LatestDiagnosticsOptions,
  latestByPeer: WeakMap<RTCPeerConnection, VoicePeerConnectionDiagnostics>,
  nowMs: number,
) {
  const peersByParticipantId: Record<string, VoicePeerConnectionDiagnostics> = {}

  for (const [participantId, peer] of options.getPeerConnectionsSnapshot()) {
    const previous = latestByPeer.get(peer)
    const isFresh =
      previous?.sampledAtMs !== null &&
      previous?.sampledAtMs !== undefined &&
      nowMs - previous.sampledAtMs <= stalePeerDiagnosticsMs

    peersByParticipantId[participantId] = isFresh
      ? refreshPeerLifecycle(previous, peer, options.lifecycleState)
      : createEmptyPeerDiagnostics(participantId, peer, options.lifecycleState)
  }

  return aggregateVoiceConnectionDiagnostics(
    Object.values(peersByParticipantId),
    options.lifecycleState,
  )
}

function refreshPeerLifecycle(
  diagnostics: VoicePeerConnectionDiagnostics,
  peer: RTCPeerConnection,
  lifecycleState: VoiceLifecycleState,
): VoicePeerConnectionDiagnostics {
  const metrics = peerDiagnosticsToMetrics(diagnostics)

  const lifecycleQualityState = resolveVoiceConnectionQualityState(
    {
      lifecycleState,
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
    },
    metrics,
  )

  return {
    ...diagnostics,
    connectionState: peer.connectionState,
    iceConnectionState: peer.iceConnectionState,
    qualityState: isMeasuredQuality(lifecycleQualityState)
      ? diagnostics.qualityState
      : lifecycleQualityState,
  }
}

function createEmptyPeerDiagnostics(
  participantId: string,
  peer: RTCPeerConnection,
  lifecycleState: VoiceLifecycleState,
): VoicePeerConnectionDiagnostics {
  return {
    participantId,
    sampledAtMs: null,
    intervalMs: null,
    inboundBitrateBps: null,
    outboundBitrateBps: null,
    inboundPacketLossPercent: null,
    outboundPacketLossPercent: null,
    packetLossPercent: null,
    roundTripTimeMs: null,
    jitterMs: null,
    qualityState: resolveVoiceConnectionQualityState({
      lifecycleState,
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
    }),
    connectionState: peer.connectionState,
    iceConnectionState: peer.iceConnectionState,
    codec: null,
    route: null,
  }
}

export function aggregateVoiceConnectionDiagnostics(
  peers: VoicePeerConnectionDiagnostics[],
  lifecycleState: VoiceLifecycleState,
): VoiceConnectionDiagnostics {
  const peersByParticipantId = Object.fromEntries(
    peers.map((peer) => [peer.participantId, peer]),
  )
  const metrics: VoiceConnectionMetrics = {
    sampledAtMs: maximumOrNull(
      peers.flatMap((peer) =>
        peer.sampledAtMs === null ? [] : [peer.sampledAtMs],
      ),
    ) ?? Date.now(),
    intervalMs: maximumOrNull(
      peers.flatMap((peer) =>
        peer.intervalMs === null ? [] : [peer.intervalMs],
      ),
    ),
    inboundBitrateBps: sumOrNull(peers.map((peer) => peer.inboundBitrateBps)),
    outboundBitrateBps: sumOrNull(peers.map((peer) => peer.outboundBitrateBps)),
    inboundPacketLossPercent: maximumOrNull(
      peers.flatMap((peer) =>
        peer.inboundPacketLossPercent === null
          ? []
          : [peer.inboundPacketLossPercent],
      ),
    ),
    outboundPacketLossPercent: maximumOrNull(
      peers.flatMap((peer) =>
        peer.outboundPacketLossPercent === null
          ? []
          : [peer.outboundPacketLossPercent],
      ),
    ),
    packetLossPercent: maximumOrNull(
      peers.flatMap((peer) =>
        peer.packetLossPercent === null ? [] : [peer.packetLossPercent],
      ),
    ),
    roundTripTimeMs: maximumOrNull(
      peers.flatMap((peer) =>
        peer.roundTripTimeMs === null ? [] : [peer.roundTripTimeMs],
      ),
    ),
    jitterMs: maximumOrNull(
      peers.flatMap((peer) =>
        peer.jitterMs === null ? [] : [peer.jitterMs],
      ),
    ),
  }
  const lifecycle = createAggregateLifecycleSnapshot(peers, lifecycleState)
  const hasSample = peers.some((peer) => peer.sampledAtMs !== null)

  const qualityMetrics = metrics.intervalMs === null ? null : metrics

  return {
    sampledAtMs: hasSample ? metrics.sampledAtMs : null,
    intervalMs: metrics.intervalMs,
    inboundBitrateBps: metrics.inboundBitrateBps,
    outboundBitrateBps: metrics.outboundBitrateBps,
    packetLossPercent: metrics.packetLossPercent,
    roundTripTimeMs: metrics.roundTripTimeMs,
    jitterMs: metrics.jitterMs,
    qualityState: resolveVoiceConnectionQualityState(lifecycle, qualityMetrics),
    codec: combineTechnicalLabels(peers.map((peer) => peer.codec)),
    route: combineTechnicalLabels(peers.map((peer) => peer.route)),
    peerCount: peers.length,
    connectedPeerCount: peers.filter(
      (peer) =>
        peer.connectionState === 'connected' ||
        peer.iceConnectionState === 'connected' ||
        peer.iceConnectionState === 'completed',
    ).length,
    peersByParticipantId,
  }
}

export function extractVoicePeerMetadata(statsLike: unknown): VoicePeerMetadata {
  const records = collectStatsRecords(statsLike)
  const recordById = new Map<string, StatsRecord>()
  const audioTransportIds: string[] = []
  const audioCodecIds: string[] = []

  for (const record of records) {
    const id = readNonEmptyString(record.id)
    if (id !== null) {
      recordById.set(id, record)
    }

    if (isAudioRtpRecord(record)) {
      const transportId = readNonEmptyString(record.transportId)
      const codecId = readNonEmptyString(record.codecId)
      if (transportId !== null) {
        audioTransportIds.push(transportId)
      }
      if (codecId !== null) {
        audioCodecIds.push(codecId)
      }
    }
  }

  const codecRecord = audioCodecIds
    .map((codecId) => recordById.get(codecId))
    .find((record) => record?.type === 'codec')
  const selectedPair = resolveSelectedCandidatePair(
    records,
    recordById,
    audioTransportIds,
  )

  return {
    codec: codecRecord ? formatCodec(codecRecord) : null,
    route: selectedPair ? formatRoute(selectedPair, recordById) : null,
  }
}

export function createVoiceQualityHysteresisState(): VoiceQualityHysteresisState {
  return {
    stableState: null,
    pendingState: null,
    pendingSamples: 0,
  }
}

export function advanceVoiceQualityHysteresis(
  current: VoiceQualityHysteresisState,
  nextState: VoiceConnectionQualityState,
) {
  if (
    current.stableState === null ||
    !isMeasuredQuality(current.stableState) ||
    !isMeasuredQuality(nextState)
  ) {
    return {
      qualityState: nextState,
      state: {
        stableState: nextState,
        pendingState: null,
        pendingSamples: 0,
      },
    }
  }

  if (current.stableState === nextState) {
    return {
      qualityState: nextState,
      state: {
        stableState: nextState,
        pendingState: null,
        pendingSamples: 0,
      },
    }
  }

  const pendingSamples =
    current.pendingState === nextState ? current.pendingSamples + 1 : 1
  const requiredSamples =
    qualitySeverity(nextState) > qualitySeverity(current.stableState) ? 2 : 3

  if (pendingSamples >= requiredSamples) {
    return {
      qualityState: nextState,
      state: {
        stableState: nextState,
        pendingState: null,
        pendingSamples: 0,
      },
    }
  }

  return {
    qualityState: current.stableState,
    state: {
      stableState: current.stableState,
      pendingState: nextState,
      pendingSamples,
    },
  }
}

function createPeerLifecycleSnapshot(
  peer: RTCPeerConnection,
): VoiceConnectionLifecycleSnapshot {
  return {
    connectionState: peer.connectionState,
    iceConnectionState: peer.iceConnectionState,
  }
}

function createAggregateLifecycleSnapshot(
  peers: VoicePeerConnectionDiagnostics[],
  lifecycleState: VoiceLifecycleState,
): VoiceConnectionLifecycleSnapshot {
  return {
    lifecycleState,
    connectionState: resolveAggregateConnectionState(peers),
    iceConnectionState: resolveAggregateIceConnectionState(peers),
  }
}

function resolveAggregateConnectionState(peers: VoicePeerConnectionDiagnostics[]) {
  const states = new Set(peers.map((peer) => peer.connectionState))
  if (states.has('failed') || states.has('closed')) return 'failed'
  if (states.has('disconnected')) return 'disconnected'
  if (states.has('new') || states.has('connecting')) return 'connecting'
  if (states.has('connected')) return 'connected'
  return null
}

function resolveAggregateIceConnectionState(peers: VoicePeerConnectionDiagnostics[]) {
  const states = new Set(peers.map((peer) => peer.iceConnectionState))
  if (states.has('failed') || states.has('closed')) return 'failed'
  if (states.has('disconnected')) return 'disconnected'
  if (states.has('new') || states.has('checking')) return 'checking'
  if (states.has('connected')) return 'connected'
  if (states.has('completed')) return 'completed'
  return null
}

function peerDiagnosticsToMetrics(
  diagnostics: VoicePeerConnectionDiagnostics,
): VoiceConnectionMetrics {
  return {
    sampledAtMs: diagnostics.sampledAtMs ?? Date.now(),
    intervalMs: diagnostics.intervalMs,
    inboundBitrateBps: diagnostics.inboundBitrateBps,
    outboundBitrateBps: diagnostics.outboundBitrateBps,
    inboundPacketLossPercent: diagnostics.inboundPacketLossPercent,
    outboundPacketLossPercent: diagnostics.outboundPacketLossPercent,
    packetLossPercent: diagnostics.packetLossPercent,
    roundTripTimeMs: diagnostics.roundTripTimeMs,
    jitterMs: diagnostics.jitterMs,
  }
}

function resolveSelectedCandidatePair(
  records: StatsRecord[],
  recordById: Map<string, StatsRecord>,
  audioTransportIds: string[],
) {
  const preferredTransports = audioTransportIds
    .map((transportId) => recordById.get(transportId))
    .filter((record): record is StatsRecord => record?.type === 'transport')
  const transports = preferredTransports.length > 0
    ? preferredTransports
    : records.filter((record) => record.type === 'transport')

  for (const transport of transports) {
    const selectedPairId = readNonEmptyString(transport.selectedCandidatePairId)
    const selectedPair = selectedPairId
      ? recordById.get(selectedPairId)
      : null
    if (selectedPair?.type === 'candidate-pair') {
      return selectedPair
    }
  }

  return (
    records.find(
      (record) =>
        record.type === 'candidate-pair' &&
        record.selected === true &&
        record.state === 'succeeded',
    ) ??
    records.find(
      (record) =>
        record.type === 'candidate-pair' &&
        record.nominated === true &&
        record.state === 'succeeded',
    ) ??
    null
  )
}

function formatCodec(record: StatsRecord) {
  const mimeType = readNonEmptyString(record.mimeType)
  if (mimeType === null) {
    return null
  }

  const subtype = mimeType.split('/').at(-1) ?? mimeType
  const codecName = `${subtype.slice(0, 1).toUpperCase()}${subtype.slice(1)}`
  const clockRate = readFiniteNumber(record.clockRate)
  const channels = readFiniteNumber(record.channels)
  const details = [
    clockRate === null ? null : `${Math.round(clockRate / 1_000)} kHz`,
    channels === null ? null : `${channels} ch`,
  ].filter((value): value is string => value !== null)

  return [codecName, ...details].join(' · ')
}

function formatRoute(
  candidatePair: StatsRecord,
  recordById: Map<string, StatsRecord>,
) {
  const localCandidateId = readNonEmptyString(candidatePair.localCandidateId)
  const remoteCandidateId = readNonEmptyString(candidatePair.remoteCandidateId)
  const localCandidate = localCandidateId
    ? recordById.get(localCandidateId)
    : null
  const remoteCandidate = remoteCandidateId
    ? recordById.get(remoteCandidateId)
    : null
  const isRelay =
    localCandidate?.candidateType === 'relay' ||
    remoteCandidate?.candidateType === 'relay'
  const hasCompleteCandidateDetails = Boolean(localCandidate && remoteCandidate)
  const protocol = [
    localCandidate?.relayProtocol,
    localCandidate?.protocol,
    remoteCandidate?.relayProtocol,
    remoteCandidate?.protocol,
  ]
    .map(readNonEmptyString)
    .find((value) => value !== null)

  const path = isRelay
    ? 'relay'
    : hasCompleteCandidateDetails
      ? 'direct'
      : 'unknown'

  return `${path}/${protocol?.toLowerCase() ?? 'unknown'}`
}

function collectStatsRecords(statsLike: unknown): StatsRecord[] {
  if (statsLike === null || statsLike === undefined) {
    return []
  }

  const values: unknown[] = []
  if (isIterable(statsLike)) {
    for (const value of statsLike) {
      values.push(value)
    }
  } else if (hasForEach(statsLike)) {
    statsLike.forEach((value) => values.push(value))
  } else if (isStatsRecord(statsLike)) {
    values.push(...Object.values(statsLike))
  }

  return values
    .map((value) =>
      Array.isArray(value) && value.length >= 2 ? value[1] : value,
    )
    .filter(isStatsRecord)
}

function isAudioRtpRecord(record: StatsRecord) {
  if (
    record.type !== 'inbound-rtp' &&
    record.type !== 'outbound-rtp' &&
    record.type !== 'remote-inbound-rtp'
  ) {
    return false
  }

  const kind = readNonEmptyString(record.kind)?.toLowerCase() ?? null
  const mediaType =
    readNonEmptyString(record.mediaType)?.toLowerCase() ?? null
  return (
    (kind === null || kind === 'audio') &&
    (mediaType === null || mediaType === 'audio')
  )
}

function combineTechnicalLabels(values: Array<string | null>) {
  const labels = Array.from(
    new Set(values.filter((value): value is string => value !== null)),
  )
  return labels.length > 0 ? labels.join(' + ') : null
}

function isMeasuredQuality(state: VoiceConnectionQualityState) {
  return state === 'good' || state === 'degraded' || state === 'poor'
}

function qualitySeverity(state: VoiceConnectionQualityState) {
  if (state === 'poor') return 2
  if (state === 'degraded') return 1
  return 0
}

function sumOrNull(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null)
  return available.length > 0
    ? available.reduce((total, value) => total + value, 0)
    : null
}

function maximumOrNull(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null
}

function readNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function readFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isStatsRecord(value: unknown): value is StatsRecord {
  return typeof value === 'object' && value !== null
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.iterator in value &&
    typeof value[Symbol.iterator] === 'function'
  )
}

function hasForEach(
  value: unknown,
): value is { forEach(callback: (item: unknown) => void): void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'forEach' in value &&
    typeof value.forEach === 'function'
  )
}

function isDocumentHidden() {
  return document.visibilityState === 'hidden'
}
