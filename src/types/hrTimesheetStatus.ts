export type HRTimesheetAutomationRunType = 'monthly_export' | 'daily_alerts';
export type HRTimesheetRunStatus = 'completed' | 'failed' | 'in_progress' | 'unknown';

export interface HRTimesheetStatusCounts {
  entries: number;
  employees: number;
  monthlyExports: number;
  dailyAlertRuns: number;
}

export interface HRTimesheetLatestMonthlyExport {
  month: string | null;
  status: HRTimesheetRunStatus;
  employeeCount: number;
  totalEntries: number;
  totalHours: number;
  outputPath: string | null;
  updatedAt: string | null;
}

export interface HRTimesheetLatestDailyAlert {
  date: string | null;
  status: HRTimesheetRunStatus;
  generatedCount: number;
  suppressedCount: number;
  updatedAt: string | null;
}

export interface HRTimesheetStatusSnapshot {
  checkedAt: string;
  headline: string;
  recommendation: string;
  counts: HRTimesheetStatusCounts;
  latestMonthlyExport: HRTimesheetLatestMonthlyExport | null;
  latestDailyAlert: HRTimesheetLatestDailyAlert | null;
  alertTotalsByType: {
    birthday: number;
    anniversary: number;
  };
}

export interface HRTimesheetStatusResponse {
  success: true;
  snapshot: HRTimesheetStatusSnapshot;
  timestamp: string;
}
