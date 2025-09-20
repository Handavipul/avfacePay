import os
from pydantic_settings import BaseSettings
from typing import Optional, List

ENV = os.getenv("APP_ENV", "development")  # default to dev
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str  

    # JWT
    JWT_SECRET_KEY: str  
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Encryption
    PAYMENT_ENCRYPTION_KEY: str 

    # AWS
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "eu-west-2"
    SNS_NOTIFICATION_TOPIC_ARN: Optional[str] = None
    SQS_PAYMENT_QUEUE_URL: Optional[str] = None
    S3_SECURE_BUCKET: Optional[str] = None
    MOLLIE_API_KEY: Optional[str] = None
    METRICS_ENABLED: bool = True
    METRICS_PATH: str = "/metrics"
    MTLS_ENABLED: bool = False 
    CLIENT_CERT_PATH: Optional[str] = "/certs/client.crt" 
    CLIENT_KEY_PATH: Optional[str] = "/certs/client.key"
    CA_CERT_PATH: Optional[str] = "/certs/ca.crt"

    # Email
    EMAIL_USER: Optional[str] = None
    EMAIL_APP_PASSWORD: Optional[str] = None  

    # SMS
    TEXTBELT_API_KEY: Optional[str] = None  
    
    # OTP
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 3
    OTP_COOLDOWN_MINUTES: int = 5
    OTP_RATE_LIMIT_PER_HOUR: int = 10
    #test data
    # URLs (read from env automatically)
    FRONTEND_URL: str
    BACKEND_URL: str

    # Derived CORS origins
    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [self.FRONTEND_URL, self.BACKEND_URL]

    class Config:
        env_file = f".env.{ENV}"
        extra = "allow"

settings = Settings()
