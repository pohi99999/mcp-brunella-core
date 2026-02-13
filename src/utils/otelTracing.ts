// FILE: src/utils/otelTracing.ts
// PURPOSE: OpenTelemetry tracing setup for Brunella Agent System.
// Exports spans via OTLP HTTP to a configurable endpoint (default: http://localhost:4319).
// Must be imported BEFORE any other application code in the entry point.

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry tracing with OTLP HTTP exporter.
 * Call this once at application startup, before any other imports.
 */
export function initOtelTracing(): void {
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4319";

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "mcp-brunella-core",
    [ATTR_SERVICE_VERSION]: "1.0.0",
  });

  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
  });

  sdk.start();
}

/**
 * Gracefully shut down the OpenTelemetry SDK (flushes pending spans).
 */
export async function shutdownOtelTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
