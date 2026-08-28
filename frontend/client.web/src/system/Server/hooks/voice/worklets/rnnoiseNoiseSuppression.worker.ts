import { Rnnoise } from '@shiguredo/rnnoise-wasm';

type RnnoiseWorkerMessage =
  { type: 'connect'; port: MessagePort } | { type: 'dispose' };

type RnnoiseProcessingMessage =
  | { type: 'process'; sequence: number; frame: Float32Array }
  | { type: 'dispose' };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RnnoiseWorkerMessage>) => void) | null;
  close: () => void;
};

let processingPort: MessagePort | null = null;
let denoiseState: ReturnType<Rnnoise['createDenoiseState']> | null = null;
let isDisposed = false;

workerScope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'dispose') {
    dispose();
    return;
  }

  processingPort?.close();
  processingPort = message.port;
  processingPort.onmessage = handleProcessingMessage;
  processingPort.start();
  void initializeRnnoise();
};

async function initializeRnnoise() {
  const port = processingPort;
  if (!port || isDisposed) {
    return;
  }

  try {
    const rnnoise = await Rnnoise.load();
    if (isDisposed || processingPort !== port) {
      return;
    }

    denoiseState?.destroy();
    denoiseState = rnnoise.createDenoiseState();
    port.postMessage({ type: 'ready', frameSize: rnnoise.frameSize });
  } catch (error) {
    if (!isDisposed && processingPort === port) {
      port.postMessage({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'RNNoise initialization failed.'
      });
    }
  }
}

function handleProcessingMessage(
  event: MessageEvent<RnnoiseProcessingMessage>
) {
  const message = event.data;
  if (message.type === 'dispose') {
    dispose();
    return;
  }

  const port = processingPort;
  const state = denoiseState;
  if (!port || !state || isDisposed) {
    return;
  }

  const startedAt = performance.now();
  try {
    for (let index = 0; index < message.frame.length; index += 1) {
      message.frame[index] =
        clampUnitSample(message.frame[index] ?? 0) * 32_768;
    }
    const voiceProbability = state.processFrame(message.frame);
    for (let index = 0; index < message.frame.length; index += 1) {
      message.frame[index] = clampUnitSample(
        (message.frame[index] ?? 0) / 32_768
      );
    }
    const processingTimeMs = performance.now() - startedAt;
    port.postMessage(
      {
        type: 'processed',
        sequence: message.sequence,
        frame: message.frame,
        processingTimeMs,
        voiceProbability
      },
      [message.frame.buffer]
    );
  } catch (error) {
    port.postMessage({
      type: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'RNNoise frame processing failed.'
    });
  }
}

function clampUnitSample(value: number) {
  return Math.min(1, Math.max(-1, value));
}

function dispose() {
  if (isDisposed) {
    return;
  }

  isDisposed = true;
  denoiseState?.destroy();
  denoiseState = null;
  processingPort?.close();
  processingPort = null;
  workerScope.close();
}

export {};
