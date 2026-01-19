/**
 * Simple Test Runner for MCP Brunella Core
 * Runs basic sanity tests on the modules
 */

const fs = require('fs').promises;
const path = require('path');

const TESTS = [
  {
    name: 'Check build directory',
    test: async () => {
      const buildPath = path.join(__dirname, '..', 'build');
      const stats = await fs.stat(buildPath);
      return stats.isDirectory();
    }
  },
  {
    name: 'Check config.yaml exists',
    test: async () => {
      const configPath = path.join(__dirname, '..', 'config.yaml');
      await fs.access(configPath);
      return true;
    }
  },
  {
    name: 'Check tools_registry.json exists',
    test: async () => {
      const registryPath = path.join(__dirname, '..', 'tools_registry.json');
      await fs.access(registryPath);
      return true;
    }
  },
  {
    name: 'Check tools_registry.json is valid JSON',
    test: async () => {
      const registryPath = path.join(__dirname, '..', 'tools_registry.json');
      const content = await fs.readFile(registryPath, 'utf-8');
      JSON.parse(content);
      return true;
    }
  },
  {
    name: 'Check task_trigger.yaml exists',
    test: async () => {
      const triggerPath = path.join(__dirname, '..', 'task_trigger.yaml');
      await fs.access(triggerPath);
      return true;
    }
  },
  {
    name: 'Check Python modules exist',
    test: async () => {
      const routerPath = path.join(__dirname, '..', 'python_modules', 'query_router.py');
      const orchestratorPath = path.join(__dirname, '..', 'python_modules', 'agent_orchestrator.py');
      await fs.access(routerPath);
      await fs.access(orchestratorPath);
      return true;
    }
  },
  {
    name: 'Check logs directory exists',
    test: async () => {
      const logsPath = path.join(__dirname, '..', 'logs');
      const stats = await fs.stat(logsPath);
      return stats.isDirectory();
    }
  },
  {
    name: 'Check scripts directory exists',
    test: async () => {
      const scriptsPath = path.join(__dirname, '..', 'scripts');
      const stats = await fs.stat(scriptsPath);
      return stats.isDirectory();
    }
  },
  {
    name: 'Check knowledge_base.md exists',
    test: async () => {
      const kbPath = path.join(__dirname, '..', 'knowledge_base.md');
      await fs.access(kbPath);
      return true;
    }
  },
  {
    name: 'Check .env.example exists',
    test: async () => {
      const envPath = path.join(__dirname, '..', '.env.example');
      await fs.access(envPath);
      return true;
    }
  }
];

async function runTests() {
  console.log('🧪 Running MCP Brunella Core Tests\n');
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const test of TESTS) {
    try {
      const result = await test.test();
      if (result) {
        console.log(`✓ ${test.name}`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);
        failed++;
        failures.push(test.name);
      }
    } catch (error) {
      console.log(`✗ ${test.name}: ${error.message}`);
      failed++;
      failures.push(test.name);
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(name => console.log(`  - ${name}`));
  }
  
  return failed === 0;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
