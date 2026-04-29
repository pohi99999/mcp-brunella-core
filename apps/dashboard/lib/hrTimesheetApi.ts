import { fetchWithTimeout, safeJson } from './apiService.js';
import type { HRTimesheetStatusResponse } from '@packages/types/hrTimesheetStatus.js';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 30000;

export async function getHRTimesheetStatusSnapshot(): Promise<HRTimesheetStatusResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/hr/timesheet/status`, {}, DEFAULT_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HR timesheet status: HTTP ${response.status}`);
  }

  return safeJson<HRTimesheetStatusResponse>(response);
}
