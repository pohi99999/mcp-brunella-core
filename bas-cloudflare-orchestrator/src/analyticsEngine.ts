export class BASAnalytics {
  constructor(private readonly env: unknown) {}

  recordSystemMetric(): void {
    void this.env;
  }

  writeDataPoint(): void {
    void this.env;
  }
}
