/**
 * Metrics Dashboard Component
 * Path: src/dashboard/components/fleet/MetricsDashboard.tsx
 * 
 * Displays metrics charts: latency, error rate, RPS
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricsChartData, FleetHealth } from './types.js';

interface MetricsDashboardProps {
  data: MetricsChartData[];
  fleetHealth: FleetHealth | null;
  timeRange?: 'hour' | 'day' | 'week';
  isLoading?: boolean;
}

const LATENCY_COLORS = {
  p50: '#3b82f6',
  p95: '#f59e0b',
  p99: '#ef4444'
};

const ERROR_RATE_COLOR = '#ef4444';
const RPS_COLOR = '#10b981';

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  data,
  fleetHealth,
  timeRange = 'hour',
  isLoading = false
}) => {
  // Latency Trend Data
  const latencyData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString('hu-HU'),
        p50: d.latency_p50,
        p95: d.latency_p95,
        p99: d.latency_p99
      })),
    [data]
  );

  // Error Rate Trend
  const errorRateData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString('hu-HU'),
        errorRate: parseFloat(d.error_rate.toFixed(2))
      })),
    [data]
  );

  // RPS (Requests Per Second)
  const rpsData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString('hu-HU'),
        rps: d.requests
      })),
    [data]
  );

  // Error Distribution Pie Chart
  const errorDistribution = [
    {
      name: 'Success',
      value: (fleetHealth?.total_requests || 0) - (fleetHealth?.total_errors || 0),
      color: '#10b981'
    },
    {
      name: 'Errors',
      value: fleetHealth?.total_errors || 0,
      color: '#ef4444'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Loading metrics...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Latency (p95)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleetHealth?.avg_latency_p95.toFixed(0) || 0}ms</div>
            <p className="text-xs text-gray-500">per request</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(fleetHealth?.avg_error_rate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {(fleetHealth?.avg_error_rate || 0).toFixed(2)}%
            </div>
            <p className="text-xs text-gray-500">
              {fleetHealth?.total_errors || 0} / {fleetHealth?.total_requests || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(fleetHealth?.total_requests || 0).toLocaleString('hu-HU')}</div>
            <p className="text-xs text-gray-500">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{fleetHealth?.active_workers || 0}</div>
            <p className="text-xs text-gray-500">/ {fleetHealth?.worker_count || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Latency Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Trend (Percentiles)</CardTitle>
          <CardDescription>P50, P95, P99 latency over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="p50" stroke={LATENCY_COLORS.p50} dot={false} />
              <Line type="monotone" dataKey="p95" stroke={LATENCY_COLORS.p95} dot={false} />
              <Line type="monotone" dataKey="p99" stroke={LATENCY_COLORS.p99} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Error Rate & RPS Combined */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Error Rate Trend</CardTitle>
            <CardDescription>Percentage of failed requests</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={errorRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" fontSize={12} />
                <YAxis label={{ value: 'Error %', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Area type="monotone" dataKey="errorRate" fill={ERROR_RATE_COLOR} stroke={ERROR_RATE_COLOR} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* RPS */}
        <Card>
          <CardHeader>
            <CardTitle>Request Volume (RPS)</CardTitle>
            <CardDescription>Requests per second</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rpsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" fontSize={12} />
                <YAxis label={{ value: 'Requests/s', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="rps" fill={RPS_COLOR} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Error Distribution Pie */}
      <Card>
        <CardHeader>
          <CardTitle>Success vs Error Distribution</CardTitle>
          <CardDescription>Ratio of successful and failed requests</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={errorDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${((entry.value / (fleetHealth?.total_requests || 1)) * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {errorDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
