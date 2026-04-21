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

// English aliases for agents with Hungarian-only triggers
const TRIGGER_ALIASES = {
  'robotkezv2': ['navigate', 'browse', 'click', 'fill form', 'scrape', 'website', 'web page', 'open url'],
  'voice': ['voice command', 'speech', 'audio input', 'whisper'],
  'law_detective': ['legal', 'regulation', 'compliance', 'law'],
  'copywriter': ['copywriting', 'write copy', 'blog post', 'article'],
  'lead_mining': ['lead generation', 'prospect', 'linkedin'],
};

function loadRegistry() {
  const raw = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  return raw.agents || raw;
}

function scoreAgent(agent, taskLower) {
  let score = 0;
  const triggers = (agent.triggers || []).map(t => t.toLowerCase());
  // Merge in English aliases if available
  const aliases = TRIGGER_ALIASES[agent.name] || [];
  const allTriggers = [...triggers, ...aliases];
  const caps = (agent.capabilities || []).map(c => c.toLowerCase());
  const desc = (agent.description || '').toLowerCase();
  const name = agent.name.toLowerCase();
  const tags = (agent.tags || []).map(t => t.toLowerCase());

  // Helper: word boundary match (avoids "invoice" matching "voice")
  const wordMatch = (haystack, needle) => {
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(haystack);
  };

  // Exact trigger match (highest weight) — word boundary required
  for (const trigger of allTriggers) {
    if (trigger.length <= 3) {
      // Short triggers: exact word boundary only
      if (wordMatch(taskLower, trigger)) score += 20;
    } else {
      // Longer triggers: word boundary match
      if (wordMatch(taskLower, trigger)) score += 20;
    }
  }

  // Capability keyword match — word boundary, min 5 chars
  for (const cap of caps) {
    const capWords = cap.split('_');
    for (const w of capWords) {
      if (w.length > 4 && wordMatch(taskLower, w)) score += 8;
    }
    // Full capability phrase match (stronger signal)
    const capPhrase = cap.replace(/_/g, ' ');
    if (taskLower.includes(capPhrase)) score += 12;
  }

  // Name match — word boundary required
  if (wordMatch(taskLower, name)) score += 15;

  // Description keyword overlap — require exact word boundaries (not substrings)
  const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);
  const descTokens = desc.split(/[\s,.:;()\-\/]+/).filter(w => w.length > 3);
  for (const tw of taskWords) {
    // Exact token match (strong)
    if (descTokens.includes(tw)) score += 5;
    // Stem-level match (weaker — only if root >= 5 chars)
    else if (tw.length >= 5 && descTokens.some(dw => dw.startsWith(tw.slice(0, 5)) || tw.startsWith(dw.slice(0, 5)))) score += 2;
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
