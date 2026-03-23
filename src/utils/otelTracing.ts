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
import { trace, SpanStatusCode, type Tracer, type Span } from "@opentelemetry/api";

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

/**
 * Get a named tracer for creating spans.
 * Usage: const tracer = getTracer('agent-manager');
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name, '1.0.0');
}

/**
 * Wrap an async function in an OpenTelemetry span.
 * Automatically records exceptions and sets status.
 */
export async function wrapWithSpan<T>(
  tracerName: string,
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer(tracerName);
  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
