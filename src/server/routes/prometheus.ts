/**
 * Prometheus Metrics Endpoint
 * Path: src/server/routes/prometheus.ts
 *
 * GET /metrics - Return metrics in Prometheus text format
 */

import { Router, Response } from 'express';
import { getMetricsText } from '../../core/prometheus.js';
import { logInfo, logError } from '../../utils/logger.js';

const router = Router();

// Cache metrics for 5 seconds to avoid recalculation
let metricsCache: string | null = null;
let metricsCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * GET /metrics
 * Return metrics in Prometheus text format
 */
router.get('/metrics', async (req, res: any) => {
  try {
    const now = Date.now();

    // Check cache
    if (metricsCache && now - metricsCacheTime < CACHE_DURATION) {
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metricsCache);
      return;
    }

    // Generate metrics
    const metrics = await getMetricsText();

    // Update cache
    metricsCache = metrics;
    metricsCacheTime = now;

    // Set response headers
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.set('Cache-Control', 'max-age=5, must-revalidate');

    // Send metrics
    res.send(metrics);

    logInfo('prometheus', `GET /metrics - success (${metrics.length} bytes)`);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError('prometheus', `Failed to generate metrics: ${errorMsg}`);
    res.status(500).set('Content-Type', 'text/plain').send('Error generating metrics\n');
  }
});

export default router;
