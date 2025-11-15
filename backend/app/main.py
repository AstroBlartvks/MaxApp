import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.logging_config import app_logger
from postgresql.database import connect_db, close_db
from app.routers import health, auth, photos, trades, websocket, transfers, profile_requests

# Загружаем переменные окружения из .env файла
load_dotenv()

app = FastAPI(
    title="Бэкенд для Владения Цифровым Искусством",
    description="Бэкенд для управления владением цифровыми объектами искусства, включая оригиналы и дубликаты.",
    version="0.1.0",
)

# Mount the static directory for uploads
UPLOADS_DIR = os.getenv("UPLOADS_DIR", "uploads")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# --- Exception Handlers ---

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Handles any unhandled exceptions, logs them, and returns a 500 error.
    """
    app_logger.error(f"Unhandled exception for {request.method} {request.url}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
        headers={
            "Access-Control-Allow-Origin": origins[0] if origins else "https://whitea.cloud",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handles Pydantic validation errors, logs them, and returns a 422 error.
    """
    # exc.errors() gives a detailed list of validation errors
    app_logger.warning(f"Validation error for {request.method} {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": exc.errors()},
        headers={
            "Access-Control-Allow-Origin": origins[0] if origins else "https://whitea.cloud",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handles HTTP exceptions and ensures CORS headers are included.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": origins[0] if origins else "https://whitea.cloud",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


# --- CORS Configuration ---
# Получаем разрешенные домены из переменных окружения
cors_origins_str = os.getenv("CORS_ORIGINS", "https://whitea.cloud,https://api.whitea.cloud,http://localhost,http://localhost:8080,http://localhost:5173")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

cors_methods_str = os.getenv("CORS_METHODS", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
cors_methods = [method.strip() for method in cors_methods_str.split(",") if method.strip()]

cors_max_age = int(os.getenv("CORS_MAX_AGE", "3600"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=cors_methods,
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=cors_max_age,
)


@app.on_event("startup")
async def startup_event():
    """Connects to the database and confirms logging setup."""
    app_logger.info("Logging configured successfully. Application starting up.")
    await connect_db()

@app.on_event("shutdown")
async def shutdown_event():
    """Closes the database connection when the application shuts down."""
    await close_db()

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(trades.router)
app.include_router(websocket.router)
app.include_router(transfers.router)
app.include_router(profile_requests.router)
