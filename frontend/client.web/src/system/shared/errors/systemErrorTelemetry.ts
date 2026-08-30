export type SystemErrorTelemetryEvent = {
  boundaryName: string;
  componentStack: string | null;
  error: Error;
  occurredAt: string;
};

export type SystemErrorTelemetryReporter = (
  event: SystemErrorTelemetryEvent
) => void;

let configuredReporter: SystemErrorTelemetryReporter | null = null;

export function setSystemErrorTelemetryReporter(
  reporter: SystemErrorTelemetryReporter | null
) {
  configuredReporter = reporter;
}

function notifyReporter(
  reporter: SystemErrorTelemetryReporter,
  event: SystemErrorTelemetryEvent
) {
  try {
    reporter(event);
  } catch (reporterError) {
    console.error(
      '[ArcaneLink] Error telemetry reporter failed.',
      reporterError
    );
  }
}

export function reportSystemError(
  event: SystemErrorTelemetryEvent,
  boundaryReporter?: SystemErrorTelemetryReporter
) {
  console.error(
    `[ArcaneLink] UI error caught by ${event.boundaryName}.`,
    event.error,
    { componentStack: event.componentStack }
  );

  if (configuredReporter) notifyReporter(configuredReporter, event);
  if (boundaryReporter && boundaryReporter !== configuredReporter) {
    notifyReporter(boundaryReporter, event);
  }
}
