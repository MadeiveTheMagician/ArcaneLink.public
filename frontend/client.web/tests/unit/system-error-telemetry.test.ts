import { expect, test } from '@playwright/test'

import {
  reportSystemError,
  setSystemErrorTelemetryReporter,
  type SystemErrorTelemetryEvent,
} from '../../src/system/shared/errors/systemErrorTelemetry'

test('reports caught UI errors through the configurable telemetry hook', () => {
  const events: SystemErrorTelemetryEvent[] = []
  const originalConsoleError = console.error
  const event: SystemErrorTelemetryEvent = {
    boundaryName: 'test-workspace',
    componentStack: 'at TestWorkspace',
    error: new Error('render failed'),
    occurredAt: '2026-07-19T00:00:00.000Z',
  }

  console.error = () => undefined
  setSystemErrorTelemetryReporter((reportedEvent) => events.push(reportedEvent))

  try {
    reportSystemError(event)
  } finally {
    setSystemErrorTelemetryReporter(null)
    console.error = originalConsoleError
  }

  expect(events).toEqual([event])
})
