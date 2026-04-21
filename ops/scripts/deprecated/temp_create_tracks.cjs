const fs = require('fs');
const path = require('path');

const trackableEndpoints = [
  'anthropic.ts', 'bookkeeping.ts', 'cognitiveBridge.ts', 'crmFollowUp.ts', 
  'developer.ts', 'ephemeral.ts', 'externalKnowledge.ts', 'federation.ts', 
  'health.ts', 'hooks.ts', 'hrLeave.ts', 'hrTimesheet.ts', 'inventory.ts', 
  'learningLoop.ts', 'logistics.ts', 'machines.ts', 'mcp.ts', 'metrics.ts', 
  'observability.ts', 'psales-strategy.ts', 'recommendation.ts', 
  'remote.ts', 'robotkez.ts', 'robotkez_pro.ts', 'sales.ts', 
  'selfModification.ts', 'tools.ts', 'tts.ts', 'zeroPrompt.ts'
];

const tracksDir = path.join(process.cwd(), 'conductor/tracks');
if (!fs.existsSync(tracksDir)) {
  fs.mkdirSync(tracksDir, { recursive: true });
}

const tracksMdPath = path.join(process.cwd(), 'conductor/tracks.md');
let tracksMdContent = '';
if (fs.existsSync(tracksMdPath)) {
    tracksMdContent = fs.readFileSync(tracksMdPath, 'utf-8');
} else {
    tracksMdContent = '# Projekt Nyomkovetes (Tracks)

';
}

trackableEndpoints.forEach(endpointFile => {
  const name = path.basename(endpointFile, '.ts');
  const trackId = `wire_up_${name}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  const trackDir = path.join(tracksDir, trackId);

  if (!fs.existsSync(trackDir)) {
    fs.mkdirSync(trackDir, { recursive: true });

    const meta = {
      id: trackId,
      name: `Integrate ${name}.ts into Dashboard/Hooks`,
      description: `Wire up the dormant API endpoints from ${endpointFile} into the appropriate Dashboard panels and/or Hook Engine listeners.`,
      status: "proposed",
      owner: "Chief of Staff (AI Architect)",
      created_at: new Date().toISOString(),
      progress: 0,
      tags: ["wiring", "audit", "dashboard"]
    };

    const spec = `# Specification for ${name}.ts Integration

**Goal:** Fully integrate the functionalities of `${endpointFile}` into the Brunella ecosystem.`;
    const plan = `# Implementation Plan for ${name}.ts

- [ ] Analyze endpoints in `${endpointFile}`.
- [ ] Identify target Dashboard panel(s).
- [ ] Implement API calls in `apiService.ts`.
- [ ] Create/update UI components to display data.
- [ ] Add relevant hooks to `advancedHooks.ts` if applicable.`;

    fs.writeFileSync(path.join(trackDir, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(trackDir, 'spec.md'), spec);
    fs.writeFileSync(path.join(trackDir, 'plan.md'), plan);

    const trackEntry = `
- [ ] **${trackId}**: Integrate ${name}.ts into Dashboard/Hooks`;
    if (!tracksMdContent.includes(trackId)) {
      tracksMdContent += trackEntry;
    }

    console.log(`Created track: ${trackId}`);
  }
});

fs.writeFileSync(tracksMdPath, tracksMdContent);
console.log('conductor/tracks.md updated.');
