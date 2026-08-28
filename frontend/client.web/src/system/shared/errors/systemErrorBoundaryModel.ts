export type SystemErrorBoundaryState = {
  error: Error | null;
  recoveryAttempt: number;
};

export function createSystemErrorBoundaryState(
  recoveryAttempt = 0
): SystemErrorBoundaryState {
  return {
    error: null,
    recoveryAttempt
  };
}

export function normalizeSystemError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (typeof error === 'string') return new Error(error);

  try {
    return new Error(JSON.stringify(error) ?? String(error));
  } catch {
    return new Error(String(error));
  }
}

export function captureSystemError(
  currentState: SystemErrorBoundaryState,
  error: unknown
): SystemErrorBoundaryState {
  return {
    ...currentState,
    error: normalizeSystemError(error)
  };
}

export function retrySystemErrorBoundary(
  currentState: SystemErrorBoundaryState
): SystemErrorBoundaryState {
  return createSystemErrorBoundaryState(currentState.recoveryAttempt + 1);
}

export function haveSystemErrorResetKeysChanged(
  previousKeys: readonly unknown[] = [],
  nextKeys: readonly unknown[] = []
) {
  if (previousKeys.length !== nextKeys.length) return true;

  return previousKeys.some((key, index) => !Object.is(key, nextKeys[index]));
}

export function formatSystemErrorDetails(error: Error) {
  return error.stack ?? `${error.name}: ${error.message}`;
}
