import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('jules_check.mjs script', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'jules_check.mjs');

  it('should exist', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('should execute successfully and return JSON status', (done) => {
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        // If the script fails (e.g. exit code 1), check if it's because of missing logs or something expected.
        // But for a "check" script, it might return 0 even if checks fail, just reporting the status.
        // Or it might return 1.
        // For this test, let's assume we want it to run without crashing node.
        // But initially, the file won't exist, so this test will definitely fail (or the previous one).
        done(error);
        return;
      }

      try {
        const output = JSON.parse(stdout);
        expect(output).toHaveProperty('status');
        expect(output).toHaveProperty('checks');
        done();
      } catch (e) {
        done(new Error(`Failed to parse output: ${stdout}. Error: ${e}`));
      }
    });
  });
});
