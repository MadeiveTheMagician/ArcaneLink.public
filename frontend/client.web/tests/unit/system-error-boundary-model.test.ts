import { expect, test } from '@playwright/test';

import {
  captureSystemError,
  createSystemErrorBoundaryState,
  formatSystemErrorDetails,
  haveSystemErrorResetKeysChanged,
  normalizeSystemError,
  retrySystemErrorBoundary
} from '../../src/system/shared/errors/systemErrorBoundaryModel';

test.describe('system error boundary model', () => {
  test('captures unknown thrown values as errors', () => {
    const captured = captureSystemError(
      createSystemErrorBoundaryState(),
      'workspace failed'
    );

    expect(captured.error).toBeInstanceOf(Error);
    expect(captured.error?.message).toBe('workspace failed');
    expect(normalizeSystemError({ code: 'render_failed' }).message).toBe(
      '{"code":"render_failed"}'
    );
  });

  test('retry clears the fallback state and advances the recovery attempt', () => {
    const captured = captureSystemError(
      createSystemErrorBoundaryState(2),
      new Error('boom')
    );
    const retried = retrySystemErrorBoundary(captured);

    expect(retried).toEqual({
      error: null,
      recoveryAttempt: 3
    });
  });

  test('resets only when a workspace reset key actually changes', () => {
    expect(
      haveSystemErrorResetKeysChanged(
        ['private-space', 'private-1'],
        ['private-space', 'private-1']
      )
    ).toBe(false);
    expect(
      haveSystemErrorResetKeysChanged(
        ['private-space', 'private-1'],
        ['private-space', 'private-2']
      )
    ).toBe(true);
    expect(
      haveSystemErrorResetKeysChanged(['server', 'server-1'], ['profile'])
    ).toBe(true);
  });

  test('formats stack details when the runtime provides them', () => {
    const error = new Error('render failed');
    error.stack = 'Error: render failed\n    at Workspace';

    expect(formatSystemErrorDetails(error)).toContain('at Workspace');
  });
});
