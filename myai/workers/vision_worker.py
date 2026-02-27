import os
import json
import base64
from typing import Optional, Dict, Any
from myai.workers.os_worker import os_worker
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

class VisionWorker:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = "gemini-2.0-flash" # High speed, good vision

    async def get_coordinates(self, element_description: str, image_path: str) -> Optional[Dict[str, int]]:
        """
        Uses Gemini Vision to find X, Y coordinates of an element in an image.
        Returns {'x': val, 'y': val} or None.
        """
        if not self.api_key:
            print("⚠️ Missing API key for VisionWorker")
            return None

        try:
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")

            llm = ChatGoogleGenerativeAI(model=self.model_name, google_api_key=self.api_key)
            
            prompt = f"""
            Identify the (x, y) pixel coordinates of the center of the following element: "{element_description}"
            Return the result ONLY as a valid JSON object: {{"x": number, "y": number}}.
            If you cannot find it, return {{"error": "not found"}}.
            The image is a screenshot of a 1920x1080 Windows desktop or browser.
            """

            message = HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_data}"},
                    },
                ]
            )

            response = llm.invoke([message])
            # Parse JSON from response
            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            
            result = json.loads(content)
            if "x" in result and "y" in result:
                return result
            return None

        except Exception as e:
            print(f"❌ VisionWorker error: {e}")
            return None

vision_worker = VisionWorker()
