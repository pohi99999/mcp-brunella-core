async function checkOllama() {
    console.log("🔍 Ollama Diagnosztika Indítása...");
    const url = "http://localhost:11434/api/tags";
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`❌ Ollama hiba: ${response.status} ${response.statusText}`);
            return;
        }
        
        const data = await response.json();
        const models = data.models || [];
        
        if (models.length === 0) {
            console.warn("⚠️ Ollama fut, de nincsenek letöltött modellek.");
        } else {
            console.log("✅ Elérhető modellek:");
            models.forEach((m: any) => console.log(`   - ${m.name} (méret: ${Math.round(m.size / 1024 / 1024)} MB)`));
            
            const targetModel = "qwen2.5-coder:1.5b";
            const hasTarget = models.some((m: any) => m.name === targetModel || m.name.startsWith(targetModel));
            
            if (!hasTarget) {
                console.warn(`\n⚠️ Figyelem: A projekt által preferált '${targetModel}' modell nem található.`);
                console.log(`💡 Javaslat: Futtasd az 'ollama pull ${targetModel}' parancsot.`);
            } else {
                console.log(`\n✨ A keresett '${targetModel}' modell rendelkezésre áll.`);
            }
        }
    } catch (error: any) {
        console.error(`\n❌ Nem sikerült elérni az Ollama-t a ${url} címen.`);
        console.error(`   Hiba: ${error.message}`);
        console.log("💡 Ellenőrizd, hogy az Ollama alkalmazás fut-e a háttérben!");
    }
}

checkOllama();
