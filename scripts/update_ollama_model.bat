@echo off
echo Creating new Modelfile...
echo FROM ./models/brunella_nightly.Q4_K_M.gguf > Modelfile.nightly
echo SYSTEM You are Brunella, an advanced AI agent. >> Modelfile.nightly

echo Registering with Ollama...
ollama create brunella-nightly -f Modelfile.nightly

echo Testing...
ollama run brunella-nightly "Ready for work?"
