import rnnoiseWorkletUrl from './worklets/rnnoiseNoiseSuppressionProcessor.worklet.ts?worker&url'
import {
  createVoiceNoiseSuppressionBaseTelemetry,
  createVoiceNoiseSuppressionFallbackTelemetry,
  detectVoiceMlNoiseSuppressionSupport,
  normalizeVoiceNoiseSuppressionProcessorTelemetry,
} from './voiceNoiseSuppressionModel'
import type {
  VoiceNoiseSuppressionFallbackReason,
  VoiceNoiseSuppressionProcessorSample,
  VoiceNoiseSuppressionRequestedMode,
  VoiceNoiseSuppressionTelemetry,
} from './voiceNoiseSuppressionModel'

export type VoiceNoiseSuppressionRuntimeRequest = {
  requestedMode: VoiceNoiseSuppressionRequestedMode
  fallbackMode: 'native' | 'disabled'
  nativeNoiseSuppressionActive: boolean
  provider?: VoiceMlNoiseSuppressionProvider | null
}

export type VoiceMlNoiseSuppressionSession = {
  inputNode: AudioNode
  outputNode: AudioNode
  dispose: () => void
}

export type VoiceMlNoiseSuppressionProvider = {
  id: string
  detectSupport: (audioContext: AudioContext) => {
    supported: boolean
    reason: VoiceNoiseSuppressionFallbackReason | null
  }
  createSession: (options: {
    audioContext: AudioContext
    onReady: () => void
    onTelemetry: (sample: VoiceNoiseSuppressionProcessorSample) => void
    onError: (reason: VoiceNoiseSuppressionFallbackReason) => void
  }) => Promise<VoiceMlNoiseSuppressionSession>
}

export type VoiceNoiseSuppressionRuntime = {
  inputNode: AudioNode | null
  outputNode: AudioNode | null
  getTelemetry: () => VoiceNoiseSuppressionTelemetry
  subscribeTelemetry: (
    listener: (telemetry: VoiceNoiseSuppressionTelemetry) => void,
  ) => () => void
  dispose: () => void
}

const providerId = '@shiguredo/rnnoise-wasm@2025.1.5'
const processorName = 'arcanelink-rnnoise'
const initializationTimeoutMs = 8_000
const workletLoadByAudioContext = new WeakMap<AudioContext, Promise<void>>()

export const rnnoiseVoiceNoiseSuppressionProvider:
  VoiceMlNoiseSuppressionProvider = {
    id: providerId,
    detectSupport(audioContext) {
      return detectVoiceMlNoiseSuppressionSupport({
        webAssembly: typeof WebAssembly !== 'undefined',
        audioWorklet:
          typeof audioContext.audioWorklet?.addModule === 'function',
        audioWorkletNode: typeof AudioWorkletNode !== 'undefined',
        worker: typeof Worker !== 'undefined',
        messageChannel: typeof MessageChannel !== 'undefined',
        sampleRate: audioContext.sampleRate,
      })
    },
    async createSession({ audioContext, onReady, onTelemetry, onError }) {
      await loadRnnoiseAudioWorklet(audioContext)

      let node: AudioWorkletNode | null = null
      let worker: Worker | null = null
      let workerChannel: MessageChannel | null = null
      try {
        node = new AudioWorkletNode(audioContext, processorName, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        })
        worker = new Worker(
          new URL(
            './worklets/rnnoiseNoiseSuppression.worker.ts',
            import.meta.url,
          ),
          { type: 'module', name: 'arcanelink-rnnoise' },
        )
        workerChannel = new MessageChannel()

        let isReady = false
        const readyPromise = waitForRnnoiseProcessorReady(
          node,
          initializationTimeoutMs,
        )
        node.port.addEventListener('message', (event: MessageEvent) => {
          const message = event.data as Record<string, unknown>

          if (message.type === 'telemetry') {
            onTelemetry(message as VoiceNoiseSuppressionProcessorSample)
          } else if (message.type === 'error' && isReady) {
            onError('processor-error')
            node?.port.postMessage({ type: 'fallback' })
            worker?.terminate()
          }
        })
        node.port.start()
        node.port.postMessage(
          { type: 'connect', port: workerChannel.port1 },
          [workerChannel.port1],
        )
        worker.postMessage(
          { type: 'connect', port: workerChannel.port2 },
          [workerChannel.port2],
        )

        void readyPromise.then(
          () => {
            isReady = true
            onReady()
          },
          (error: unknown) => {
            onError(
              isInitializationTimeoutError(error)
                ? 'initialization-timeout'
                : 'processor-error',
            )
            node?.port.postMessage({ type: 'fallback' })
            worker?.terminate()
          },
        )

        let isDisposed = false
        return {
          inputNode: node,
          outputNode: node,
          dispose() {
            if (isDisposed) {
              return
            }

            isDisposed = true
            node?.port.postMessage({ type: 'dispose' })
            node?.port.close()
            node?.disconnect()
            worker?.postMessage({ type: 'dispose' })
            worker?.terminate()
            workerChannel?.port1.close()
            workerChannel?.port2.close()
          },
        }
      } catch (error) {
        node?.port.postMessage({ type: 'dispose' })
        node?.port.close()
        node?.disconnect()
        worker?.terminate()
        workerChannel?.port1.close()
        workerChannel?.port2.close()
        throw error
      }
    },
  }

export async function createVoiceNoiseSuppressionRuntime(
  audioContext: AudioContext,
  request: VoiceNoiseSuppressionRuntimeRequest,
): Promise<VoiceNoiseSuppressionRuntime> {
  const provider = request.provider === undefined
    ? rnnoiseVoiceNoiseSuppressionProvider
    : request.provider
  const listeners = new Set<
    (telemetry: VoiceNoiseSuppressionTelemetry) => void
  >()
  let session: VoiceMlNoiseSuppressionSession | null = null
  let isDisposed = false
  let telemetry = createVoiceNoiseSuppressionBaseTelemetry({
    requestedMode: request.requestedMode,
    nativeNoiseSuppressionActive: request.nativeNoiseSuppressionActive,
    providerId: request.requestedMode === 'ml' ? provider?.id ?? null : null,
  })

  function publish(nextTelemetry: VoiceNoiseSuppressionTelemetry) {
    if (isDisposed) {
      return
    }

    telemetry = nextTelemetry
    listeners.forEach((listener) => listener(nextTelemetry))
  }

  function publishFallback(
    reason: VoiceNoiseSuppressionFallbackReason,
    didProviderFail = false,
  ) {
    publish(
      createVoiceNoiseSuppressionFallbackTelemetry({
        requestedMode: request.requestedMode,
        fallbackMode: request.fallbackMode,
        nativeNoiseSuppressionActive:
          request.nativeNoiseSuppressionActive,
        reason,
        providerId: provider?.id ?? null,
        didProviderFail,
      }),
    )
  }

  if (request.requestedMode === 'ml') {
    if (!provider) {
      publishFallback('provider-unavailable')
    } else {
      const support = provider.detectSupport(audioContext)
      if (!support.supported) {
        publishFallback(support.reason ?? 'provider-unavailable')
      } else {
        try {
          session = await provider.createSession({
            audioContext,
            onReady() {
              publish({
                ...telemetry,
                activeMode: 'ml',
                lifecycle: 'active',
                health: 'healthy',
                fallbackReason: null,
                sampledAtMs: Date.now(),
              })
            },
            onTelemetry(sample) {
              publish(
                normalizeVoiceNoiseSuppressionProcessorTelemetry(
                  telemetry,
                  sample,
                ),
              )
            },
            onError(reason) {
              publishFallback(reason, true)
            },
          })
        } catch (error) {
          publishFallback(
            isInitializationTimeoutError(error)
              ? 'initialization-timeout'
              : 'provider-initialization-failed',
            true,
          )
        }
      }
    }
  }

  return {
    inputNode: session?.inputNode ?? null,
    outputNode: session?.outputNode ?? null,
    getTelemetry: () => telemetry,
    subscribeTelemetry(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (isDisposed) {
        return
      }

      session?.dispose()
      session = null
      telemetry = {
        ...telemetry,
        lifecycle: 'disposed',
        sampledAtMs: Date.now(),
      }
      listeners.forEach((listener) => listener(telemetry))
      listeners.clear()
      isDisposed = true
    },
  }
}

async function loadRnnoiseAudioWorklet(audioContext: AudioContext) {
  const existing = workletLoadByAudioContext.get(audioContext)
  if (existing) {
    return await existing
  }

  const pending = audioContext.audioWorklet.addModule(rnnoiseWorkletUrl)
  workletLoadByAudioContext.set(audioContext, pending)
  try {
    await pending
  } catch (error) {
    workletLoadByAudioContext.delete(audioContext)
    throw error
  }
}

function waitForRnnoiseProcessorReady(
  node: AudioWorkletNode,
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new VoiceNoiseSuppressionInitializationTimeoutError())
    }, timeoutMs)

    function handleMessage(event: MessageEvent) {
      const message = event.data as Record<string, unknown>
      if (message.type === 'ready') {
        cleanup()
        resolve()
      } else if (message.type === 'error') {
        cleanup()
        reject(
          new Error(
            typeof message.message === 'string'
              ? message.message
              : 'RNNoise processor initialization failed.',
          ),
        )
      }
    }

    function cleanup() {
      window.clearTimeout(timeoutId)
      node.port.removeEventListener('message', handleMessage)
    }

    node.port.addEventListener('message', handleMessage)
    node.port.start()
  })
}

class VoiceNoiseSuppressionInitializationTimeoutError extends Error {
  constructor() {
    super('RNNoise processor initialization timed out.')
    this.name = 'VoiceNoiseSuppressionInitializationTimeoutError'
  }
}

function isInitializationTimeoutError(error: unknown) {
  return error instanceof VoiceNoiseSuppressionInitializationTimeoutError
}

export type {
  VoiceNoiseSuppressionFallbackReason,
  VoiceNoiseSuppressionRequestedMode,
  VoiceNoiseSuppressionTelemetry,
} from './voiceNoiseSuppressionModel'
