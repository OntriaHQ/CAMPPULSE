from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://camppulse:devpassword@localhost:5432/camppulse_dev"
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "minimum_32_char_secret_key_change_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    environment: str = "development"

    rate_limit_guest: int = 60
    rate_limit_resident: int = 300
    rate_limit_driver: int = 300
    rate_limit_admin: int = 600

    def rate_limit_for_role(self, role: str) -> int:
        if role == "admin":
            return self.rate_limit_admin
        if role in ("resident", "driver"):
            return self.rate_limit_resident
        return self.rate_limit_guest


settings = Settings()
