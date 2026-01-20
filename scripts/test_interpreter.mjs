import { spawn } from "child_process";

const interpreterPath = "F:\\OneDrive\\Desktop\\Brunella_es_en\\open-interpreter\\venv311\\Scripts\\interpreter.exe";
const configPath = "F:\\OneDrive\\Desktop\\Brunella_es_en\\open-interpreter\\config.yaml";
const prompt = "What time is it?";

console.log("Testing Open Interpreter via stdin (Ollama)...");
const args = [
  "-y", 
  "--plain", 
  "--stdin", 
  "--model", "ollama/tinyllama", 
  "--api_base", "http://localhost:11434"
];

const proc = spawn(interpreterPath, args, { shell: true });

proc.stdout.on('data', (data) => process.stdout.write(data));
proc.stderr.on('data', (data) => process.stderr.write(data));

proc.stdin.write(prompt + "\n");
proc.stdin.end();

proc.on('close', (code) => {
  console.log(`\nInterpreter finished with code ${code}`);
  process.exit(code);
});

