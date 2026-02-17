import os
import sys
import json
import base64
import requests
from io import BytesIO
import google.generativeai as genai

# Try to import PIL, but don't fail immediately if not present
try:
    from PIL import Image
except ImportError:
    Image = None

class GeminiVisionWorker:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        # Initialize model if key is present
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None

    def load_image(self, image_source: str) -> "Image.Image":
        if Image is None:
            raise ImportError("Pillow library is not installed")

        try:
            if image_source.startswith("http://") or image_source.startswith("https://"):
                response = requests.get(image_source, timeout=30)
                response.raise_for_status()
                return Image.open(BytesIO(response.content))
            elif os.path.isfile(image_source):
                return Image.open(image_source)
            elif image_source.startswith("data:image"):
                # Base64 data URI
                header, encoded = image_source.split(",", 1)
                data = base64.b64decode(encoded)
                return Image.open(BytesIO(data))
            else:
                # Assume base64 string
                try:
                    data = base64.b64decode(image_source)
                    return Image.open(BytesIO(data))
                except:
                    raise ValueError(f"Invalid image source: {image_source[:50]}...")
        except Exception as e:
            raise ValueError(f"Failed to load image from source: {e}")

    def analyze_image(self, image_source: str, prompt: str) -> dict:
        if not self.model:
            return {"error": "GEMINI_API_KEY not configured"}

        try:
            image = self.load_image(image_source)
            
            # Request JSON output in the prompt
            full_prompt = f"{prompt}\n\nPlease output the result as valid JSON."
            
            response = self.model.generate_content([full_prompt, image])
            text = response.text
            
            # Try to extract JSON
            try:
                # Find the first { and last }
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end != -1:
                    json_str = text[start:end]
                    return json.loads(json_str)
                else:
                     # Fallback if no JSON block found
                    return {"raw_text": text}
            except json.JSONDecodeError:
                return {"raw_text": text, "error": "Failed to parse JSON"}

        except Exception as e:
            return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        image_source = sys.argv[1]
        prompt = sys.argv[2]
        
        worker = GeminiVisionWorker()
        result = worker.analyze_image(image_source, prompt)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Usage: python vision_worker.py <image_source> <prompt>"}))
