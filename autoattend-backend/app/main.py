from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.core.exceptions import sqlalchemy_integrity_error_handler
from app.api.v1 import api_router

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    # Set all CORS enabled origins
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.BACKEND_CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Exception Handlers
    app.add_exception_handler(IntegrityError, sqlalchemy_integrity_error_handler)

    @app.get("/")
    def root():
        return {"message": f"Welcome to {settings.PROJECT_NAME}"}
        
    # Include routers
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app

app = create_app()
