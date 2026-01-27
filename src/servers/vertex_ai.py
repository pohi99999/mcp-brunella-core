# src/servers/vertex_ai.py - Vertex AI MCP Module
import os
import vertexai
from vertexai.generative_models import GenerativeModel
from fastmcp import FastMCP

# Inicializáljuk az MCP szervert
mcp = FastMCP("Vertex AI Module")

def init_vertex():
    """Inicializálja a Vertex AI környezetet."""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    
    if not project_id:
        # Próbáljuk meg a google.auth.default()-ot, ha nincs env var
        import google.auth
        try:
            _, project_id = google.auth.default()
        except Exception:
            pass

    if project_id:
        vertexai.init(project=project_id, location=location)
        return True
    return False

@mcp.tool()
def vertex_generate_content(prompt: str, model_name: str = "gemini-1.5-flash-001") -> str:
    """
    Generál szöveges tartalmat a Google Vertex AI (Gemini) modell segítségével.
    
    Args:
        prompt: A generáláshoz használt prompt.
        model_name: A használni kívánt modell neve (pl. "gemini-1.5-flash-001", "gemini-1.5-pro-001").
    """
    if not init_vertex():
        return "Hiba: A Vertex AI nincs konfigurálva. Állítsa be a GOOGLE_CLOUD_PROJECT környezeti változót vagy a credentials fájlt."

    try:
        model = GenerativeModel(model_name)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Hiba a generálás során: {str(e)}"

@mcp.tool()
def vertex_list_models() -> str:
    """
    Listázza az elérhető (támogatott) modelleket (statikus lista a gyakoriakról).
    """
    models = [
        "gemini-1.5-flash-001 - Gyors és költséghatékony",
        "gemini-1.5-pro-001 - Nagy teljesítményű, komplex feladatokhoz",
        "gemini-1.0-pro - Régebbi stabil verzió"
    ]
    return "\n".join(models)

if __name__ == "__main__":
    mcp.run(transport="stdio")
