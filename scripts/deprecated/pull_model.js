async function pullModel() {
    console.log("Sending pull request to Ollama API for llama3.1:latest...");
    try {
        const response = await fetch("http://localhost:11434/api/pull", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "llama3.1:latest",
                stream: false // Wait until finished
            })
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);

    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

pullModel();