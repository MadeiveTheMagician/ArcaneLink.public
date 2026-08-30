import {
  resolveVoiceAudioContext,
  resumeVoiceAudioContext
} from './voiceAudioContextRecovery';
import {
  createDirectVoiceInputStream,
  isDirectVoiceInputStreamReady,
  setDirectVoiceInputGate,
  shouldUseDirectVoiceInputTransport
} from './voiceInputDirectTransport';
import type { VoiceInputTransportMode } from './voiceInputDirectTransport';
import { microphoneGainPercentToLinearGain } from './voiceInputGateModel';
import { createVoiceNoiseSuppressionRuntime } from './voiceNoiseSuppressionRuntime';
import type {
  VoiceNoiseSuppressionRuntime,
  VoiceNoiseSuppressionRuntimeRequest
} from './voiceNoiseSuppressionRuntime';

export type VoiceInputPipeline = {
  transportMode: VoiceInputTransportMode;
  directTransportCanTransmit: boolean;
  rawStream: MediaStream;
  outboundStream: MediaStream;
  audioContext: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  noiseSuppressionRuntime: VoiceNoiseSuppressionRuntime | null;
  inputGain: GainNode | null;
  limiter: DynamicsCompressorNode | null;
  outboundGate: GainNode | null;
  destination: MediaStreamAudioDestinationNode | null;
};

export type VoiceInputPipelineOptions = {
  noiseSuppression?: VoiceNoiseSuppressionRuntimeRequest;
};

export async function createVoiceInputPipeline(
  rawStream: MediaStream,
  microphoneGainPercent: number,
  existingAudioContext: AudioContext | null = null,
  options: VoiceInputPipelineOptions = {}
): Promise<VoiceInputPipeline> {
  const rawTrack = rawStream.getAudioTracks()[0] ?? null;
  if (!rawTrack) {
    return {
      transportMode: 'empty',
      directTransportCanTransmit: false,
      rawStream,
      outboundStream: new MediaStream(),
      audioContext: null,
      source: null,
      noiseSuppressionRuntime: null,
      inputGain: null,
      limiter: null,
      outboundGate: null,
      destination: null
    };
  }

  rawTrack.enabled = true;
  if (
    shouldUseDirectVoiceInputTransport({
      microphoneGainPercent,
      noiseSuppressionMode: options.noiseSuppression?.requestedMode
    })
  ) {
    return createDirectVoiceInputPipeline(rawStream, rawTrack);
  }

  const audioContext = resolveVoiceAudioContext(
    existingAudioContext,
    () => new AudioContext()
  );
  const source = audioContext.createMediaStreamSource(rawStream);
  const noiseSuppressionRuntime = options.noiseSuppression
    ? await createVoiceNoiseSuppressionRuntime(
        audioContext,
        options.noiseSuppression
      )
    : null;
  const inputGain = audioContext.createGain();
  const limiter = audioContext.createDynamicsCompressor();
  const outboundGate = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();

  inputGain.gain.value = microphoneGainPercentToLinearGain(
    microphoneGainPercent
  );
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  outboundGate.gain.value = 0;
  if (
    noiseSuppressionRuntime?.inputNode &&
    noiseSuppressionRuntime.outputNode
  ) {
    source.connect(noiseSuppressionRuntime.inputNode);
    noiseSuppressionRuntime.outputNode.connect(inputGain);
  } else {
    source.connect(inputGain);
  }
  inputGain.connect(limiter);
  limiter.connect(outboundGate);
  outboundGate.connect(destination);

  const outboundTrack = destination.stream.getAudioTracks()[0] ?? null;
  if (outboundTrack && 'contentHint' in outboundTrack) {
    outboundTrack.contentHint = 'speech';
  }

  const pipeline: VoiceInputPipeline = {
    transportMode: 'processed',
    directTransportCanTransmit: true,
    rawStream,
    outboundStream: destination.stream,
    audioContext,
    source,
    noiseSuppressionRuntime,
    inputGain,
    limiter,
    outboundGate,
    destination
  };

  if (await resumeVoiceInputPipeline(pipeline)) {
    return pipeline;
  }

  pipeline.outboundStream.getTracks().forEach((track) => track.stop());
  disposeVoiceInputProcessingGraph(
    pipeline,
    audioContext !== existingAudioContext
  );
  return createDirectVoiceInputPipeline(
    rawStream,
    rawTrack,
    microphoneGainPercent > 0
  );
}

export async function resumeVoiceInputPipeline(
  pipeline: VoiceInputPipeline | null
) {
  if (pipeline?.transportMode === 'direct') {
    return isDirectVoiceInputStreamReady(pipeline.outboundStream);
  }

  return resumeVoiceAudioContext(pipeline?.audioContext ?? null);
}

export function setVoiceInputGain(
  pipeline: VoiceInputPipeline | null,
  microphoneGainPercent: number
) {
  if (pipeline?.transportMode === 'direct') {
    pipeline.directTransportCanTransmit = microphoneGainPercent > 0;
    return;
  }

  if (!pipeline?.inputGain || !pipeline.audioContext) {
    return;
  }

  const now = pipeline.audioContext.currentTime;
  const gain = pipeline.inputGain.gain;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(
    microphoneGainPercentToLinearGain(microphoneGainPercent),
    now,
    0.01
  );
}

export function setVoiceInputGate(
  pipeline: VoiceInputPipeline | null,
  isOpen: boolean,
  immediate = false
) {
  if (pipeline?.transportMode === 'direct') {
    setDirectVoiceInputGate(
      pipeline.outboundStream,
      isOpen,
      pipeline.directTransportCanTransmit
    );
    return;
  }

  if (!pipeline?.outboundGate || !pipeline.audioContext) {
    return;
  }

  const now = pipeline.audioContext.currentTime;
  const gain = pipeline.outboundGate.gain;
  gain.cancelScheduledValues(now);

  if (immediate) {
    gain.setValueAtTime(isOpen ? 1 : 0, now);
    return;
  }

  gain.setTargetAtTime(isOpen ? 1 : 0, now, isOpen ? 0.006 : 0.012);
}

export function disposeVoiceInputPipeline(
  pipeline: VoiceInputPipeline | null,
  closeAudioContext = false
) {
  if (!pipeline) {
    return;
  }

  pipeline.rawStream.getTracks().forEach((track) => {
    track.onended = null;
    track.onmute = null;
    track.onunmute = null;
    track.stop();
  });
  pipeline.outboundStream.getTracks().forEach((track) => track.stop());
  disposeVoiceInputProcessingGraph(pipeline, closeAudioContext);
}

function createDirectVoiceInputPipeline(
  rawStream: MediaStream,
  rawTrack: MediaStreamTrack,
  directTransportCanTransmit = true
): VoiceInputPipeline {
  return {
    transportMode: 'direct',
    directTransportCanTransmit,
    rawStream,
    outboundStream: createDirectVoiceInputStream(rawTrack),
    audioContext: null,
    source: null,
    noiseSuppressionRuntime: null,
    inputGain: null,
    limiter: null,
    outboundGate: null,
    destination: null
  };
}

function disposeVoiceInputProcessingGraph(
  pipeline: VoiceInputPipeline,
  closeAudioContext: boolean
) {
  pipeline.source?.disconnect();
  pipeline.noiseSuppressionRuntime?.dispose();
  pipeline.inputGain?.disconnect();
  pipeline.limiter?.disconnect();
  pipeline.outboundGate?.disconnect();
  pipeline.destination?.disconnect();
  if (closeAudioContext) {
    void pipeline.audioContext?.close();
  }
}
