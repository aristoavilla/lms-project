import { logs, SeverityNumber, type Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

type LogLevel = "debug" | "info" | "warn" | "error";

const posthogEnabled = ((import.meta.env.VITE_PUBLIC_POSTHOG_ENABLED as string | undefined) ?? "true") !== "false";
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
const posthogHost = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
const otelEnabledRaw = import.meta.env.VITE_PUBLIC_OTEL_LOGS_ENABLED as string | undefined;
const otelEnabled = otelEnabledRaw ? otelEnabledRaw !== "false" : posthogEnabled;
const explicitEndpoint = import.meta.env.VITE_PUBLIC_OTEL_LOGS_ENDPOINT as string | undefined;
const otelServiceName = (import.meta.env.VITE_PUBLIC_OTEL_SERVICE_NAME as string | undefined) ?? "lms-frontend";

let initialized = false;
let logger: Logger | null = null;
let provider: LoggerProvider | null = null;

function canInit() {
  return Boolean(otelEnabled && posthogKey && typeof window !== "undefined");
}

function buildEndpoint() {
  if (explicitEndpoint) {
    return explicitEndpoint;
  }
  return `${posthogHost.replace(/\/$/, "")}/i/v1/logs`;
}

function severityToNumber(level: LogLevel) {
  switch (level) {
    case "debug":
      return SeverityNumber.DEBUG;
    case "info":
      return SeverityNumber.INFO;
    case "warn":
      return SeverityNumber.WARN;
    case "error":
      return SeverityNumber.ERROR;
  }
}

function normalizeAttributes(context?: Record<string, unknown>) {
  if (!context) {
    return undefined;
  }

  const attributes: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
      continue;
    }

    if (value == null) {
      attributes[key] = "null";
      continue;
    }

    attributes[key] = JSON.stringify(value);
  }

  return {
    ...attributes,
    service_name: otelServiceName,
  };
}

export function initOtelLogs() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (!canInit()) {
    return;
  }

  const exporter = new OTLPLogExporter({
    url: buildEndpoint(),
    headers: {
      Authorization: `Bearer ${posthogKey}`,
    },
  });

  provider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor(exporter)],
  });
  logs.setGlobalLoggerProvider(provider);
  logger = logs.getLogger("lms-frontend");

  window.addEventListener("pagehide", () => {
    void provider?.forceFlush();
  });
}

export function emitOtelLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!logger) {
    return;
  }

  logger.emit({
    body: message,
    severityText: level.toUpperCase(),
    severityNumber: severityToNumber(level),
    attributes: normalizeAttributes(context),
  });
}