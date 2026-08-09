from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from app.config import settings
from app.api.v1.endpoints.interview import router as interview_router
from app.api.v1.endpoints.extension import router as extension_router
from app.api.v1.endpoints.judge import router as judge_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise AI Interview Layer backend exposing interview and Chrome Extension endpoints"
)

# Exception handler for HTTP 429 Quota Exhaustion
@app.exception_handler(429)
async def quota_exceeded_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "GEMINI_QUOTA_EXHAUSTED",
            "message": "AI analysis is temporarily unavailable because the Gemini API quota has been exhausted.",
            "retryable": True,
            "detail": getattr(exc, "detail", "Gemini API quota is currently unavailable.")
        }
    )

# CORS Middleware setup for Chrome Extension & Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*|http://localhost:\d+|http://127.0.0.1:\d+|https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 interview, extension and judge endpoints
app.include_router(interview_router, prefix="/api", tags=["Interview"])
app.include_router(interview_router, prefix="/api/v1", tags=["Interview v1"])
app.include_router(extension_router, prefix="/api", tags=["Extension"])
app.include_router(extension_router, prefix="/api/v1", tags=["Extension v1"])
app.include_router(judge_router, prefix="/api", tags=["Judge Demo"])
app.include_router(judge_router, prefix="/api/v1", tags=["Judge Demo v1"])


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root access to interactive API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for service status verification."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get("/api/system/gemini-diagnostic", tags=["System"])
async def gemini_diagnostic():
    """Minimal diagnostic endpoint making exactly 1 Gemini request using runtime config."""
    import time
    from app.utils.llm import get_llm
    from langchain_core.messages import HumanMessage
    
    key = settings.GEMINI_API_KEY
    fingerprint = settings.get_key_fingerprint(key)
    model = settings.GEMINI_MODEL
    
    if not key:
        return {
            "model": model,
            "key_fingerprint": "NONE",
            "key_loaded": False,
            "request_count": 0,
            "status_code": 400,
            "result": "MISSING_API_KEY"
        }
        
    start_time = time.time()
    try:
        llm = get_llm(temperature=0.0, model_name=model, api_key_override=key)
        if not llm:
            return {
                "model": model,
                "key_fingerprint": fingerprint,
                "key_loaded": True,
                "request_count": 1,
                "status_code": 500,
                "result": "LLM_INITIALIZATION_FAILED"
            }
        res = await llm.ainvoke([HumanMessage(content="Respond OK")])
        elapsed = int((time.time() - start_time) * 1000)
        return {
            "model": model,
            "key_fingerprint": fingerprint,
            "key_loaded": True,
            "request_count": 1,
            "status_code": 200,
            "duration_ms": elapsed,
            "result": "SUCCESS",
            "response": str(res.content)
        }
    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        err_str = str(e)
        status_code = 429 if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str) else 500
        error_cat = "RESOURCE_EXHAUSTED" if status_code == 429 else "GEMINI_ERROR"
        return {
            "model": model,
            "key_fingerprint": fingerprint,
            "key_loaded": True,
            "request_count": 1,
            "status_code": status_code,
            "duration_ms": elapsed,
            "result": error_cat,
            "error_detail": err_str[:300]
        }
