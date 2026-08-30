export type SerializedLatestTaskResult<T> = {
  value: T;
  sequence: number;
  isLatest: boolean;
};

export function createSerializedLatestTaskQueue<T>() {
  let tail: Promise<void> = Promise.resolve();
  let latestSequence = 0;
  let pendingCount = 0;

  function enqueue(task: () => Promise<T>) {
    const sequence = ++latestSequence;
    pendingCount += 1;
    const execution = tail.then(task);

    tail = execution.then(
      () => undefined,
      () => undefined
    );

    return execution
      .then((value): SerializedLatestTaskResult<T> => ({
        value,
        sequence,
        isLatest: sequence === latestSequence
      }))
      .finally(() => {
        pendingCount -= 1;
      });
  }

  return {
    enqueue,
    getLatestSequence: () => latestSequence,
    getPendingCount: () => pendingCount
  };
}
