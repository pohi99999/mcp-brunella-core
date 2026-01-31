// const fetch = require('node-fetch'); // Native fetch in Node 18+

async function testOllama() {
    console.log("Testing Ollama connection...");
    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.1:latest",
                prompt: "Say hi",
                stream: false
            })
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Raw Response:", text);
        
        try {
            const json = JSON.parse(text);
            console.log("Parsed Response:", json.response);
        } catch (e) {
            console.log("JSON Parse Error:", e.message);
        }

    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

testOllama();