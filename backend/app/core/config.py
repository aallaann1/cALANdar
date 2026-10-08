from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "cALANdar"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_TLS: bool = True
    SMTP_SENDER_NAME: str
    SMTP_SENDER_EMAIL: str
    FRONTEND_URL: str = "http://localhost:8080"
    GOOGLE_CLIENT_ID: str
    ADMIN_EMAIL: str = "alanterrier11@gmail.com"
    UPLOAD_DIR: str = "uploads"

    class Config:
        env_file = ".env"

settings = Settings()
