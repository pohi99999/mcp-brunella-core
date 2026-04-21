import os, sys, json, asyncio, argparse, logging
from typing import Optional, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv
from browser_use import Agent, ChatGoogle

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
logging.basicConfig(stream=sys.stderr, level=logging.INFO)

class BrowserTaskResult(BaseModel):
    success: bool
    status: str = "success"
    final_answer: str
    extracted_data: Optional[Dict[str, Any]] = None
    screenshot_path: Optional[str] = None
    error: Optional[str] = None

async def run_browser_task(task, headless=True, use_vision=True):
    try:
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key: raise ValueError('No API key')
        # A listázott modellek közül a gemini-2.0-flash tűnik a legstabilabbnak az újak közül
        llm = ChatGoogle(model='gemini-2.0-flash')
        agent = Agent(task=task, llm=llm, use_vision=use_vision)
        history = await agent.run()

        final_result_str = str(history.final_result())

        # COMET logic: Check if agent is stuck or failed based on output keywords
        error_keywords = ["error", "hiba", "failed", "cannot", "stuck", "nem sikerült"]
        if any(keyword in final_result_str.lower() for keyword in error_keywords):
            return BrowserTaskResult(
                success=False,
                status="handoff",
                final_answer=f"Kérlek segíts, elakadtam: {final_result_str}",
                extracted_data={'len': len(history.history)}
            )

        return BrowserTaskResult(
            success=True,
            status="success",
            final_answer=final_result_str,
            extracted_data={'len': len(history.history)}
        )
    except Exception as e:
        return BrowserTaskResult(success=False, status="error", final_answer='Error', error=str(e))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', type=str, required=True)
    parser.add_argument('--headless', type=str, default='True')
    parser.add_argument('--vision', type=str, default='True')
    args = parser.parse_args()
    result = asyncio.run(run_browser_task(args.task, args.headless.lower()=='true', args.vision.lower()=='true'))
    print(result.model_dump_json())
