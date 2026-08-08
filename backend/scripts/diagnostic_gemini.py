import sys
import os
import time
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings

def get_fingerprint(key: str) -> str:
    if not key:
        return "NONE"
    key = key.strip()
    if len(key) <= 10:
        return f"{key[:2]}...{key[-2:]} (length={len(key)})"
    return f"{key[:6]}...{key[-4:]} (length={len(key)})"

def test_model(model_name: str, key: str):
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage
    start_time = time.time()
    try:
        print(f"\n--- Testing Model: {model_name} ---")
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=key,
            temperature=0.0,
            max_retries=0
        )
        res = llm.invoke([HumanMessage(content="Hello")])
        elapsed = int((time.time() - start_time) * 1000)
        print(f"SUCCESS ({elapsed}ms): {res.content}")
        return True
    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        print(f"FAILED ({elapsed}ms): {type(e).__name__} - {e}")
        return False

def run_diagnostic():
    print("==================================================")
    print("RUNTIME KEY & MODEL TEST MATRIX")
    print("==================================================")
    
    active_key = settings.GEMINI_API_KEY
    print(f"Active Key Fingerprint: {get_fingerprint(active_key)}")
    
    models = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"]
    for m in models:
        test_model(m, active_key)

if __name__ == "__main__":
    run_diagnostic()
