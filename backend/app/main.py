from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.config import settings
from app.api.v1.endpoints.interview import router as interview_router
from app.api.v1.endpoints.extension import router as extension_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise AI Interview Layer backend exposing interview and Chrome Extension endpoints"
)

# CORS Middleware setup for Chrome Extension & Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 interview and extension endpoints
app.include_router(interview_router, prefix="/api", tags=["Interview"])
app.include_router(interview_router, prefix="/api/v1", tags=["Interview v1"])
app.include_router(extension_router, prefix="/api", tags=["Extension"])
app.include_router(extension_router, prefix="/api/v1", tags=["Extension v1"])


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
