import fs from 'fs';

const oldRegistry = JSON.parse(fs.readFileSync('f:\\mcp-brunella-core\\_br_temp\\registry_0d177faf.json', 'utf8'));
const currentRegistry = JSON.parse(fs.readFileSync('f:\\mcp-brunella-core\\src\\agents\\registry.json', 'utf8'));

console.log(`\n=== REGISTRY ÖSSZEHASONLÍTÁS ===`);
console.log(`Régi (0d177faf): ${oldRegistry.agents.length} agent`);
console.log(`Jelenlegi: ${currentRegistry.agents.length} agent`);

const oldClasses = oldRegistry.agents.map(a => a.class);
const currentClasses = currentRegistry.agents.map(a => a.class);

const inOldNotInCurrent = oldRegistry.agents.filter(a => !currentClasses.includes(a.class));

console.log(`\n=== A RÉGI REGISTRY-BAN VAN, DE A JELENLEGI-BEN NINCS (${inOldNotInCurrent.length}) ===`);
inOldNotInCurrent.forEach(a => {
  console.log(`  - ${a.name} (${a.class})`);
});
