declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;

  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][]
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

type WorkerMessage =
  | { type: 'ready'; frameSize: number }
  | {
      type: 'processed';
      sequence: number;
      frame: Float32Array;
      processingTimeMs: number;
      voiceProbability: number;
    }
  | { type: 'error'; message: string };

const processorName = 'arcanelink-rnnoise';
const sampleRateHz = 48_000;
const minimumBufferedFrames = 2;
const maximumFramesInFlight = 8;
const telemetryIntervalFrames = 100;

class RnnoiseNoiseSuppressionProcessor extends AudioWorkletProcessor {
  private processingPort: MessagePort | null = null;
  private inputBuffer = new FloatSampleRing(8_192);
  private outputBuffer = new FloatSampleRing(65_536);
  private frameSize = 0;
  private nextSequence = 0;
  private minimumAcceptedSequence = 0;
  private inFlightSequences = new Set<number>();
  private processedFrames = 0;
  private droppedFrames = 0;
  private outputUnderruns = 0;
  private processingTimeTotalMs = 0;
  private isOutputActive = false;
  private isDisposed = false;
  private renderQuantumCount = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      const message = event.data as
        | { type: 'connect'; port: MessagePort }
        | { type: 'fallback' }
        | { type: 'dispose' };

      if (message.type === 'connect') {
        this.connectWorker(message.port);
      } else if (message.type === 'fallback') {
        this.fallbackToBypass();
      } else if (message.type === 'dispose') {
        this.dispose();
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0]?.[0] ?? null;
    const output = outputs[0]?.[0] ?? null;
    if (!output) {
      return !this.isDisposed;
    }

    if (this.isDisposed) {
      output.fill(0);
      return false;
    }

    if (!this.processingPort || this.frameSize <= 0) {
      copyOrSilence(input, output);
      return true;
    }

    if (input && !this.inputBuffer.write(input)) {
      this.droppedFrames += 1;
      this.resynchronizeProcessingQueue();
      output.fill(0);
      this.publishTelemetryIfDue();
      return true;
    }

    this.dispatchPendingFrames();
    if (
      !this.isOutputActive &&
      this.outputBuffer.available >= this.frameSize * minimumBufferedFrames
    ) {
      this.isOutputActive = true;
    }

    if (this.isOutputActive && this.outputBuffer.available >= output.length) {
      this.outputBuffer.readInto(output);
    } else {
      if (this.isOutputActive) {
        this.outputUnderruns += 1;
        this.resynchronizeProcessingQueue();
      }
      // Once RNNoise starts receiving audio, raw and processed copies must never
      // share the output timeline. A short silence preserves ordering during the
      // initial fixed-latency warm-up and while recovering from an underrun.
      output.fill(0);
    }

    this.publishTelemetryIfDue();
    return true;
  }

  private connectWorker(port: MessagePort) {
    this.processingPort?.close();
    this.processingPort = port;
    port.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleWorkerMessage(event.data);
    };
    port.start();
  }

  private handleWorkerMessage(message: WorkerMessage) {
    if (message.type === 'ready') {
      this.frameSize = message.frameSize;
      this.port.postMessage({
        type: 'ready',
        frameSize: message.frameSize
      });
      return;
    }

    if (message.type === 'error') {
      this.port.postMessage(message);
      return;
    }

    if (!this.inFlightSequences.delete(message.sequence)) {
      return;
    }
    this.processedFrames += 1;
    this.processingTimeTotalMs += finiteNonNegative(message.processingTimeMs);
    if (message.sequence < this.minimumAcceptedSequence) {
      this.droppedFrames += 1;
      this.dispatchPendingFrames();
      return;
    }
    if (!this.outputBuffer.write(message.frame)) {
      this.droppedFrames += 1;
    }
    this.dispatchPendingFrames();
  }

  private dispatchPendingFrames() {
    const processingPort = this.processingPort;
    if (!processingPort || this.frameSize <= 0) {
      return;
    }

    while (
      this.inputBuffer.available >= this.frameSize &&
      this.inFlightSequences.size < maximumFramesInFlight
    ) {
      const frame = new Float32Array(this.frameSize);
      this.inputBuffer.readInto(frame);
      const sequence = this.nextSequence;
      this.nextSequence += 1;
      this.inFlightSequences.add(sequence);
      processingPort.postMessage({ type: 'process', sequence, frame }, [
        frame.buffer
      ]);
    }

    if (
      this.inputBuffer.available >= this.frameSize &&
      this.inFlightSequences.size >= maximumFramesInFlight
    ) {
      this.inputBuffer.discard(this.frameSize);
      this.droppedFrames += 1;
    }
  }

  private publishTelemetryIfDue() {
    this.renderQuantumCount += 1;
    if (this.renderQuantumCount < telemetryIntervalFrames) {
      return;
    }

    this.renderQuantumCount = 0;
    const averageProcessingTimeMs =
      this.processedFrames > 0
        ? this.processingTimeTotalMs / this.processedFrames
        : 0;
    const frameDurationMs =
      this.frameSize > 0 ? (this.frameSize / sampleRateHz) * 1000 : 0;
    const queuedLatencyMs =
      ((this.outputBuffer.available +
        this.inFlightSequences.size * this.frameSize) /
        sampleRateHz) *
      1000;

    this.port.postMessage({
      type: 'telemetry',
      averageProcessingTimeMs,
      frameDurationMs,
      algorithmicLatencyMs: Math.max(
        frameDurationMs * minimumBufferedFrames,
        queuedLatencyMs
      ),
      processedFrames: this.processedFrames,
      droppedFrames: this.droppedFrames,
      outputUnderruns: this.outputUnderruns,
      bufferedSamples: this.outputBuffer.available,
      inFlightFrames: this.inFlightSequences.size
    });
    this.processedFrames = 0;
    this.droppedFrames = 0;
    this.outputUnderruns = 0;
    this.processingTimeTotalMs = 0;
  }

  private dispose() {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.processingPort?.postMessage({ type: 'dispose' });
    this.processingPort?.close();
    this.processingPort = null;
    this.inputBuffer.clear();
    this.outputBuffer.clear();
    this.inFlightSequences.clear();
  }

  private fallbackToBypass() {
    this.processingPort?.close();
    this.processingPort = null;
    this.frameSize = 0;
    this.inFlightSequences.clear();
    this.minimumAcceptedSequence = this.nextSequence;
    this.isOutputActive = false;
    this.inputBuffer.clear();
    this.outputBuffer.clear();
  }

  private resynchronizeProcessingQueue() {
    this.minimumAcceptedSequence = this.nextSequence;
    this.isOutputActive = false;
    this.inputBuffer.clear();
    this.outputBuffer.clear();
  }
}

class FloatSampleRing {
  private readonly values: Float32Array;
  private readOffset = 0;
  private writeOffset = 0;
  private size = 0;

  constructor(capacity: number) {
    this.values = new Float32Array(capacity);
  }

  get available() {
    return this.size;
  }

  write(values: Float32Array) {
    if (values.length > this.values.length - this.size) {
      return false;
    }

    for (let index = 0; index < values.length; index += 1) {
      this.values[this.writeOffset] = values[index] ?? 0;
      this.writeOffset = (this.writeOffset + 1) % this.values.length;
    }
    this.size += values.length;
    return true;
  }

  readInto(target: Float32Array) {
    const readable = Math.min(target.length, this.size);
    for (let index = 0; index < readable; index += 1) {
      target[index] = this.values[this.readOffset] ?? 0;
      this.readOffset = (this.readOffset + 1) % this.values.length;
    }
    if (readable < target.length) {
      target.fill(0, readable);
    }
    this.size -= readable;
    return readable;
  }

  discard(length: number) {
    const discarded = Math.min(length, this.size);
    this.readOffset = (this.readOffset + discarded) % this.values.length;
    this.size -= discarded;
  }

  clear() {
    this.readOffset = 0;
    this.writeOffset = 0;
    this.size = 0;
  }
}

function copyOrSilence(input: Float32Array | null, output: Float32Array) {
  if (!input) {
    output.fill(0);
    return;
  }

  output.set(input.subarray(0, output.length));
  if (input.length < output.length) {
    output.fill(0, input.length);
  }
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

registerProcessor(processorName, RnnoiseNoiseSuppressionProcessor);

export {};
