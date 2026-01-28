import assert from 'assert';
import { DataScientistAgent } from '../src/agents/DataScientistAgent.js';

async function runTest() {
    console.log("Starting Data Scientist Agent Test...");
    const agent = new DataScientistAgent();

    const rawInput = "<div>  Ez egy nagyon fontos logisztikai adat!  <a href='http://spam.com'>Click me</a> </div>";
    const expectedTopic = "logisztika";

    console.log(`Input: ${rawInput}`);
    
    try {
        const result = await agent.refineData(rawInput, 'test_suite');
        console.log("Result:", JSON.stringify(result, null, 2));

        assert.ok(result, "Result should not be null");
        // The regex in python script: re.sub('<.*?>', '', raw_text) removes tags.
        // re.sub(r'http\S+', '', clean) removes URLs.
        // "Ez egy nagyon fontos logisztikai adat! Click me" might be slightly different depending on space handling.
        // Clean: "Ez egy nagyon fontos logisztikai adat! Click me" -> URLs removed?
        // Wait, the python script removes http links: clean = re.sub(r'http\S+', '', clean)
        // <a href='http://spam.com'>Click me</a> -> Click me (tags removed first? or urls first?)
        // Script:
        // 1. clean = re.sub('<.*?>', '', raw_text) -> "  Ez egy nagyon fontos logisztikai adat!  Click me "
        // 2. clean = re.sub(r'http\S+', '', clean) -> No http left in text content.
        // 3. clean = " ".join(clean.split()) -> "Ez egy nagyon fontos logisztikai adat! Click me"

        assert.strictEqual(result.clean_content, "Ez egy nagyon fontos logisztikai adat! Click me", "Text cleaning verification");
        assert.ok(result.metadata.detected_topics.includes(expectedTopic), "Topic should be detected");
        assert.strictEqual(result.metadata.is_actionable, true, "Should be actionable");

        console.log("✅ Test Passed!");
    } catch (e) {
        console.error("❌ Test Failed:", e);
        process.exit(1);
    } finally {
        await agent.stop();
    }
}

runTest();
