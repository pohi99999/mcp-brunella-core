import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SafeZoneValidator } from '../src/security/safe_zone_validator.js';
import fs from 'fs';
import path from 'path';

describe('SafeZoneValidator', () => {
  let validator: SafeZoneValidator;
  const testConfigPath = path.resolve('test/fixtures/safe_zones_test.json');
  const testDataDir = path.resolve('data/test_safe_zone');
  const testLogPath = path.resolve('logs/test_audit.log');

  const testConfig = {
    version: '1.0',
    description: 'Test Config',
    safe_zones: [
      {
        name: 'Data',
        path: 'data/test_safe_zone',
        permissions: ['read', 'write'],
        description: 'Test data',
        max_file_size_mb: 10,
        allowed_extensions: ['txt', 'json', 'csv']
      },
      {
        name: 'Logs',
        path: 'logs',
        permissions: ['read', 'write', 'append'],
        description: 'Logs',
        max_file_size_mb: 50,
        allowed_extensions: ['log']
      },
      {
        name: 'Incubator',
        path: 'myai/incubator',
        permissions: ['read', 'write', 'execute'],
        description: 'Incubator',
        max_file_size_mb: 100,
        allowed_extensions: ['py']
      },
      {
        name: 'Tracks',
        path: 'conductor/tracks',
        permissions: ['read', 'write'],
        description: 'Tracks',
        max_file_size_mb: 10,
        allowed_extensions: ['json']
      }
    ],
    blacklist: ['.env', '*.key'],
    audit: {
      enabled: true,
      log_path: 'logs/test_audit.log',
      retention_days: 1,
      log_denied_attempts: true,
      alert_on_suspicious_patterns: true,
      suspicious_patterns: ['/etc/', '../']
    },
    rate_limiting: {
      enabled: true,
      max_operations_per_minute: 100,
      max_operations_per_hour: 1000,
      burst_allowance: 5
    },
    security: {
      enforce_path_normalization: true,
      block_symlinks: true,
      verify_file_signatures: false,
      sandbox_mode: true
    }
  };

  beforeEach(async () => {
    // Setup test environment
    if (!fs.existsSync(path.dirname(testConfigPath))) {
      fs.mkdirSync(path.dirname(testConfigPath), { recursive: true });
    }
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    if (!fs.existsSync(path.dirname(testLogPath))) {
      fs.mkdirSync(path.dirname(testLogPath), { recursive: true });
    }
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }

    validator = new SafeZoneValidator(testConfigPath);
    await validator.initialize();
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(path.dirname(testConfigPath))) {
        fs.rmSync(path.dirname(testConfigPath), { recursive: true, force: true });
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testLogPath)) {
      try {
        fs.unlinkSync(testLogPath);
      } catch (e) {}
    }
  });

  describe('Permission Validation', () => {
    it('should allow read operation in Data Safe Zone', async () => {
      const testFile = path.join(testDataDir, 'data.txt');
      const result = await validator.validate(testFile, 'read');
      expect(result).toBe(true);
    });

    it('should deny write operation if disallowed extension', async () => {
      const badFile = path.join(testDataDir, 'malware.exe');
      const result = await validator.validate(badFile, 'write');
      expect(result).toBe(false);
    });

    it('should deny access outside Safe Zones', async () => {
      const outsideFile = path.resolve('../../etc/passwd');
      const result = await validator.validate(outsideFile, 'read');
      expect(result).toBe(false);
    });

    it('should deny blacklisted files', async () => {
        const envFile = path.resolve('.env');
        const result = await validator.validate(envFile, 'read');
        expect(result).toBe(false);
    });

    it('should detect suspicious patterns', async () => {
        const suspiciousPath = path.join(testDataDir, '../etc/passwd');
        const result = await validator.validate(suspiciousPath, 'read');
        expect(result).toBe(false);
    });

    it('should deny delete operation in Tracks Safe Zone (read/write only)', async () => {
        const trackFile = path.resolve('conductor/tracks/test_track/meta.json');
        const result = await validator.validate(trackFile, 'delete');
        expect(result).toBe(false);
    });

    it('should allow write operation in Data Safe Zone', async () => {
        const dataFile = path.join(testDataDir, 'output.csv');
        const result = await validator.validate(dataFile, 'write');
        expect(result).toBe(true);
    });

    it('should allow execute operation in Incubator Safe Zone', async () => {
        const incubatorFile = path.resolve('myai/incubator/test_script.py');
        const result = await validator.validate(incubatorFile, 'execute');
        expect(result).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log operations to audit log', async () => {
      const testFile = path.join(testDataDir, 'data.txt');
      await validator.validate(testFile, 'read');

      // Wait a bit for file write
      await new Promise(r => setTimeout(r, 100));

      const logs = await validator.getAuditLog(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].path).toBe(path.resolve(testFile));
      expect(logs[0].verdict).toBe('ALLOWED');
    });

    it('should log denied operations', async () => {
        const badFile = path.resolve('../../etc/passwd');
        await validator.validate(badFile, 'read');

        await new Promise(r => setTimeout(r, 100));

        const logs = await validator.getAuditLog(10);
        const deniedLog = logs.find(l => l.path === badFile);
        expect(deniedLog).toBeDefined();
        expect(deniedLog?.verdict).toBe('DENIED');
    });

    it('should include zone information in audit entries', async () => {
        const testFile = path.join(testDataDir, 'data.txt');
        await validator.validate(testFile, 'read');
        await new Promise(r => setTimeout(r, 100));
        const logs = await validator.getAuditLog(10);
        expect(logs[0].zone).toBeDefined();
        expect(logs[0].zone).toContain('Data');
    });

    it('should include timestamp in ISO format', async () => {
        const testFile = path.join(testDataDir, 'data.txt');
        await validator.validate(testFile, 'read');
        await new Promise(r => setTimeout(r, 100));
        const logs = await validator.getAuditLog(10);
        expect(logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/);
    });
  });

  describe('Rate Limiting', () => {
      it('should allow operations under rate limit', async () => {
          const testFile = path.join(testDataDir, 'data.txt');
          for (let i = 0; i < 10; i++) {
              const result = await validator.validate(testFile, 'read');
              expect(result).toBe(true);
          }
      });
  });

  describe('File Extension Validation', () => {
      it('should allow write operation for allowed extensions', async () => {
          const jsonFile = path.join(testDataDir, 'data.json');
          const result = await validator.validate(jsonFile, 'write');
          expect(result).toBe(true);
      });

      it('should deny write operation for disallowed extensions', async () => {
          const exeFile = path.join(testDataDir, 'malware.exe');
          const result = await validator.validate(exeFile, 'write');
          expect(result).toBe(false);
      });
  });

  describe('Utility Methods', () => {
      it('should return list of configured safe zones', () => {
          const zones = validator.getSafeZones();
          expect(zones.length).toBeGreaterThan(0);
          expect(zones[0].name).toBeDefined();
          expect(zones[0].path).toBeDefined();
      });

      it('should retrieve recent audit log entries', async () => {
          const testFile = path.join(testDataDir, 'data.txt');
          await validator.validate(testFile, 'read');
          await validator.validate(testFile, 'read');
          await new Promise(r => setTimeout(r, 100));
          const recentLogs = await validator.getAuditLog(5);
          expect(recentLogs.length).toBeGreaterThanOrEqual(2);
      });
  });
});
