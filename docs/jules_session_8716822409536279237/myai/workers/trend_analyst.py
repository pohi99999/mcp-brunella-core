import argparse
import asyncio
import json
import os
import re
from datetime import datetime
from typing import List, Optional, Union

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

load_dotenv()

# Pydantic Model for MarketTrendReport
class MarketTrendReport(BaseModel):
    keywords: List[str] = Field(description="List of trending keywords related to the product/market.")
    visualStyle: str = Field(description="Description of the current visual style trend.")
    competitorHooks: List[str] = Field(description="List of effective hooks used by competitors.")
    viralTopics: List[str] = Field(description="List of viral topics related to the product category.")

async def analyze_trends(product_name: str, description: str, target_audience: str, platforms: List[str]) -> dict:
    """
    Analyzes market trends for a given product using browser-use.
    """
    try:
        from browser_use import Agent, ChatGoogle
    except ImportError:
        return {"error": "browser-use not installed. Please run: pip install browser-use"}

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GOOGLE_API_KEY or GEMINI_API_KEY is missing."}
    
    # Set GOOGLE_API_KEY for browser-use if not set
    if not os.getenv("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = api_key

    # Construct the task prompt
    task_prompt = f"""
    You are a Trend Analyst for a marketing campaign.
    Product: {product_name}
    Description: {description}
    Target Audience: {target_audience}
    Platforms: {', '.join(platforms)}

    Your task is to research current market trends relevant to this product on the specified platforms.
    Identify:
    1. Trending keywords.
    2. The prevailing visual style.
    3. Effective hooks used by competitors.
    4. Viral topics in this category.

    Output the result as a strict JSON object matching this structure:
    {{
        "keywords": ["keyword1", "keyword2", ...],
        "visualStyle": "description of visual style",
        "competitorHooks": ["hook1", "hook2", ...],
        "viralTopics": ["topic1", "topic2", ...]
    }}
    Do not include any markdown formatting (like ```json). Just the raw JSON string.
    """

    llm = ChatGoogle(model="gemini-2.0-flash")
    agent = Agent(task=task_prompt, llm=llm)

    # Retry logic
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Timeout logic (3 minutes = 180 seconds)
            result = await asyncio.wait_for(agent.run(), timeout=180)
            
            # Extract JSON from result
            # Handle potential non-string return types from browser-use
            if isinstance(result, str):
                content = result
            else:
                # If it's an object, try to convert to string or access a history method if known.
                # Assuming str() gives a representation or it has a text/content attribute.
                # Based on browser_worker.py, it seems we can json dump it or use it.
                # But here we expect the LLM's final answer which should be text.
                # If agent.run() returns history, we need the last message.
                # For now, let's assume str(result) or simple access works as per browser_worker.py usage.
                try:
                    content = result.final_result() # Hypothetical method
                except AttributeError:
                    content = str(result)

            # Try to find JSON block if mixed with text
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                json_str = match.group(0)
            else:
                json_str = content

            try:
                data = json.loads(json_str)
                # Validate with Pydantic
                report = MarketTrendReport(**data)
                return report.model_dump()
            except (json.JSONDecodeError, ValidationError) as e:
                print(f"Attempt {attempt + 1}: JSON validation failed: {e}")
                if attempt == max_retries - 1:
                    return {"error": f"Failed to generate valid JSON after {max_retries} attempts. Last error: {e}", "raw_output": content}
                continue # Retry

        except asyncio.TimeoutError:
            print(f"Attempt {attempt + 1}: Timeout reached.")
            if attempt == max_retries - 1:
                return {"error": "Operation timed out."}
        except Exception as e:
            print(f"Attempt {attempt + 1}: Error: {e}")
            if attempt == max_retries - 1:
                return {"error": str(e)}

    return {"error": "Unknown error"}

def save_report(report: dict, product_name: str):
    """Saves the report to _KNOWLEDGE_BASE/campaigns/[DATE]_[PRODUCT]/trend_report.json"""
    date_str = datetime.now().strftime("%Y%m%d")
    # Slugify product name (simple version)
    slug = re.sub(r'[^a-zA-Z0-9]', '_', product_name).lower()
    folder_name = f"{date_str}_{slug}"
    
    base_path = "_KNOWLEDGE_BASE/campaigns"
    output_dir = os.path.join(base_path, folder_name)
    
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "trend_report.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"Report saved to: {output_path}")
    return output_path

async def main():
    parser = argparse.ArgumentParser(description="Trend Analyst Worker")
    parser.add_argument("--request", type=str, help="JSON string of the request")
    parser.add_argument("--file", type=str, help="Path to JSON file containing the request")
    
    args = parser.parse_args()
    
    request_data = {}
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File not found: {args.file}")
            return
        with open(args.file, "r", encoding="utf-8") as f:
            request_data = json.load(f)
    elif args.request:
        request_data = json.loads(args.request)
    else:
        print("No request provided. Usage: python trend_analyst.py --request '...' or --file '...'")
        return

    product_name = request_data.get("productName")
    description = request_data.get("description", "")
    target_audience = request_data.get("targetAudience", "")
    platforms = request_data.get("platforms", ["web"])

    if not product_name:
        print("Error: productName is required.")
        return

    print(f"Starting Trend Analysis for: {product_name}...")
    report = await analyze_trends(product_name, description, target_audience, platforms)
    
    if "error" in report:
        print(f"Analysis failed: {report['error']}")
    else:
        save_report(report, product_name)
        print("Analysis complete.")

if __name__ == "__main__":
    asyncio.run(main())
