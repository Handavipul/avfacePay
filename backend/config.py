import os
from pydantic_settings import BaseSettings
from typing import Optional, List
import boto3
import json

def get_secret(secret_name: str, region_name: str):
    client = boto3.client("secretsmanager", region_name=region_name)
    response = client.get_secret_value(SecretId=secret_name)
    secret = response["SecretString"]
    return json.loads(secret)


ENV = os.getenv("APP_ENV", "development")  # default to dev

# Name of your secret in AWS Secrets Manager
SECRET_NAME = "facepay/backend/secrets"
AWS_REGION = "eu-west-2"  # default region

# Fetch secret values
secrets = get_secret(SECRET_NAME, AWS_REGION)

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = f"postgresql://{secrets['DB_USER']}:{secrets['DB_PASSWORD']}@localhost:5432/facepay_db"

    # JWT
    JWT_SECRET_KEY: str = secrets.get("JWT_SECRET_KEY", "default_jwt_secret")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Encryption
    PAYMENT_ENCRYPTION_KEY: str = secrets.get("PAYMENT_ENCRYPTION_KEY", "default_payment_key")

    # AWS
    AWS_ACCESS_KEY_ID: str = secrets.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str = secrets.get("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = AWS_REGION
    SNS_NOTIFICATION_TOPIC_ARN: Optional[str] = secrets.get("SNS_NOTIFICATION_TOPIC_ARN")
    SQS_PAYMENT_QUEUE_URL: Optional[str] = secrets.get("SQS_PAYMENT_QUEUE_URL")
    S3_SECURE_BUCKET: Optional[str] = secrets.get("S3_SECURE_BUCKET")
    MOLLIE_API_KEY: Optional[str] = secrets.get("MOLLIE_API_KEY")
    METRICS_ENABLED: bool = True
    METRICS_PATH: str = "/metrics"
    MTLS_ENABLED: bool = False 
    CLIENT_CERT_PATH: Optional[str] = "/certs/client.crt" 
    CLIENT_KEY_PATH: Optional[str] = "/certs/client.key"
    CA_CERT_PATH: Optional[str] = "/certs/ca.crt"

    # Email
    EMAIL_USER: Optional[str] = secrets.get("EMAIL_USER")
    EMAIL_APP_PASSWORD: Optional[str] = secrets.get("EMAIL_APP_PASSWORD")  

    # SMS
    TEXTBELT_API_KEY: Optional[str] = secrets.get("TEXTBELT_API_KEY")  
    
    # OTP
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 3
    OTP_COOLDOWN_MINUTES: int = 5
    OTP_RATE_LIMIT_PER_HOUR: int = 10

    # URLs
    FRONTEND_URL: str = secrets.get("FRONTEND_URL", "https://d11xb5nruw2esr.cloudfront.net/")
    BACKEND_URL: str = secrets.get("BACKEND_URL", "https://13.42.102.183:8000/")

    # Derived CORS origins
    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [self.FRONTEND_URL, self.BACKEND_URL]

    class Config:
        extra = "allow"  # allow extra fields

settings = Settings()
