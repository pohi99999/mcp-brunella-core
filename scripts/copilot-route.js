#!/usr/bin/env node
/**
 * Copilot-Route: Offline agent routing for BAS
 * Reads registry.json, matches task to best agent(s) using trigger keywords + capabilities.
 * Does NOT require BAS Express server to be running.
 * 
 * Usage:
 *   node scripts/copilot-route.js "Fix TypeScript lint errors"
 *   node scripts/copilot-route.js --list
 *   node scripts/copilot-route.js --domain coding
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, '..', 'src', 'agents', 'registry.json');

function loadRegistry() {
  const raw = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  return raw.agents || raw;
}

function scoreAgent(agent, taskLower) {
  let score = 0;
  const triggers = (agent.triggers || []).map(t => t.toLowerCase());
  const caps = (agent.capabilities || []).map(c => c.toLowerCase());
  const desc = (agent.description || '').toLowerCase();
  const name = agent.name.toLowerCase();
  const tags = (agent.tags || []).map(t => t.toLowerCase());

  // Exact trigger match (highest weight)
  for (const trigger of triggers) {
    if (taskLower.includes(trigger)) score += 20;
  }

  // Capability keyword match
  for (const cap of caps) {
    const capWords = cap.split('_');
    for (const w of capWords) {
      if (w.length > 2 && taskLower.includes(w)) score += 8;
    }
  }

  // Name match
  if (taskLower.includes(name)) score += 15;

  // Description keyword overlap
  const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);
  const descWords = desc.split(/\s+/).filter(w => w.length > 3);
  for (const tw of taskWords) {
    if (descWords.some(dw => dw.includes(tw) || tw.includes(dw))) score += 3;
  }

  // Tag match
  for (const tag of tags) {
    if (taskLower.includes(tag)) score += 5;
  }

  // Priority boost (higher priority = more specialized)
  score += (agent.priority || 0) * 0.5;

  return score;
}

function routeTask(task) {
  const agents = loadRegistry();
  const taskLower = task.toLowerCase();

  const scored = agents
    .map(a => ({ name: a.name, score: scoreAgent(a, taskLower), agent: a }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      bestAgent: 'orchestrator',
      confidence: 0.3,
      reason: 'No specific match found, falling back to orchestrator',
      alternatives: []
    };
  }

  const best = scored[0];
  const maxScore = Math.max(best.score, 1);
  const confidence = Math.min(best.score / 30, 1.0);

  return {
    bestAgent: best.name,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Matched with score ${best.score} (triggers/caps/desc overlap)`,
    description: best.agent.description,
    capabilities: best.agent.capabilities || [],
    alternatives: scored.slice(1, 4).map(s => ({
      name: s.name,
      score: s.score,
      confidence: Math.round(Math.min(s.score / 30, 1.0) * 100) / 100
    }))
  };
}

function listByDomain(domain) {
  const agents = loadRegistry();
  const domainLower = domain.toLowerCase();
  
  const domainKeywords = {
    coding: ['code', 'lint', 'typescript', 'developer', 'compile', 'build', 'refactor'],
    research: ['research', 'search', 'scraping', 'rag', 'knowledge'],
    marketing: ['marketing', 'campaign', 'copy', 'social', 'content', 'post'],
    browser: ['browser', 'web', 'scrape', 'robotkez', 'chrome', 'playwright'],
    devops: ['devops', 'deploy', 'ci/cd', 'monitor', 'infrastructure', 'ops'],
    design: ['design', 'ux', 'ui', 'wireframe', 'accessibility'],
    legal: ['legal', 'law', 'compliance', 'regulation'],
    finance: ['finance', 'invoice', 'ocr', 'payment', 'budget'],
    sales: ['sales', 'lead', 'crm', 'customer', 'linkedin'],
    project: ['project', 'track', 'conductor', 'plan', 'status', 'task'],
    data: ['data', 'analyz', 'scientist', 'pipeline', 'refine'],
    quality: ['quality', 'test', 'audit', 'health', 'validate', 'qa']
  };

  const keywords = domainKeywords[domainLower] || [domainLower];
  
  return agents.filter(a => {
    const text = [
      a.name, a.description, 
      ...(a.capabilities || []), 
      ...(a.triggers || []),
      ...(a.tags || [])
    ].join(' ').toLowerCase();
    return keywords.some(kw => text.includes(kw));
  }).map(a => ({
    name: a.name,
    description: a.description,
    capabilities: a.capabilities || [],
    priority: a.priority || 0
  }));
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log('Usage:');
  console.log('  node scripts/copilot-route.js "task description"  - Route to best agent');
  console.log('  node scripts/copilot-route.js --list               - List all agents');
  console.log('  node scripts/copilot-route.js --domain coding      - List agents by domain');
  console.log('  node scripts/copilot-route.js --domains            - List all domains');
  process.exit(0);
}

if (args[0] === '--list') {
  const agents = loadRegistry();
  console.log(JSON.stringify(agents.map(a => ({
    name: a.name,
    description: (a.description || '').substring(0, 80),
    capabilities: a.capabilities || [],
    priority: a.priority || 0
  })), null, 2));
  process.exit(0);
}

if (args[0] === '--domains') {
  const domains = ['coding', 'research', 'marketing', 'browser', 'devops', 'design', 
                    'legal', 'finance', 'sales', 'project', 'data', 'quality'];
  domains.forEach(d => {
    const agents = listByDomain(d);
    console.log(`${d}: ${agents.map(a => a.name).join(', ')}`);
  });
  process.exit(0);
}

if (args[0] === '--domain') {
  const domain = args[1] || 'coding';
  console.log(JSON.stringify(listByDomain(domain), null, 2));
  process.exit(0);
}

// Default: route task
const task = args.join(' ');
const result = routeTask(task);
console.log(JSON.stringify(result, null, 2));
