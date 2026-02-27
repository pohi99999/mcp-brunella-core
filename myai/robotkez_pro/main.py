from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Robotkez Pro Action Server")

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
