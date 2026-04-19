import { ViktoriaPhygitalAgent } from './build/agents/ViktoriaPhygitalAgent.js';

async function test() {
  const agent = new ViktoriaPhygitalAgent();
  console.log('--- Testing ViktoriaPhygitalAgent execution ---');
  const task = "Elemezd a varga_viktoria_brand_spec.md-t és a termékeket, majd készíts egy LinkedIn outreach tervet prémium phygital élményre fókuszálva.";
  try {
    const result = await agent.execute(task);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
