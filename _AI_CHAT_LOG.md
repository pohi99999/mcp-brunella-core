# Learnings

- **ts-node/esm quirks**: Running TypeScript scripts with  can be sensitive to import paths ( extension required) and generic syntax in classes (maybe?). Using specific types instead of generics resolved a crash.
- **RAG Caching**: Implementing LRU cache for embeddings significantly improves performance (simulated 200x improvement on failure path, likely higher on success path).
- **Environment Dependencies**: Running tests requires a fully configured environment (Ollama, API keys). Without it, many tests fail, making it hard to verify unrelated changes. Focused benchmarks are crucial.
