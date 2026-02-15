/**
 * Fleet Manager Types
 * Path: src/dashboard/components/fleet/types.ts
 */

export interface Fleet {
  id: string;
  name: string;
  region: string;
  enabled: boolean;
  created_at: string;
  worker_count?: number;
  avg_error_rate?: number;
  avg_latency_p95?: number;
}

export interface Worker {
  id: string;
  fleet_id: string;
  name: string;
  status: 'active' | 'paused' | 'draining' | 'error';
  url: string;
  error_count: number;
  requests_total: number;
  last_heartbeat: string | null;
  created_at: string;
}

export interface WorkerMetrics {
  worker_id: string;
  timestamp: string;
  latency_p50?: number;
  latency_p95?: number;
  latency_p99?: number;
  request_count: number;
  error_count: number;
  error_rate: number;
  memory_usage_mb?: number;
  cloudflare_location?: string;
}

export interface FleetHealth {
  fleet_id: string;
  worker_count: number;
  active_workers: number;
  avg_error_rate: number;
  max_latency_p95: number;
  avg_latency_p95: number;
  total_requests: number;
  total_errors: number;
}

export interface ScalingPolicy {
  fleet_id: string;
  scale_up_threshold_latency_ms: number;
  scale_up_threshold_error_rate: number;
  scale_down_threshold_latency_ms: number;
  scale_down_threshold_error_rate: number;
  scale_down_duration_minutes: number;
  cooldown_minutes: number;
  min_workers: number;
  max_workers: number;
}

export interface ScalingEvent {
  id: string;
  fleet_id: string;
  event_type: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
  instance_count_before: number;
  instance_count_after: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface MetricsChartData {
  timestamp: string;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  error_rate: number;
  requests: number;
}
