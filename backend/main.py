from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import portfolio, risk, stress, auth, market, stocks, password_reset, stocks_financials , insights
from app.models.password_reset_token import PasswordResetToken
from app.db.database import create_tables

create_tables()

app = FastAPI(
    title = "Portfolio Risk Analytics API",
    description = "api to analyze portfolio risk",
    version = "0.1.0",
    docs_url = "/docs", # to automatically come with documentation which we can view from web browser
    redoc_url = "/redocs" # to automatically come with documentation which we can view from web browser
)

app.add_middleware(
    CORSMiddleware, # cross origin resource sharing, to allow certain url to interact with backend
    allow_origins = settings.ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods = ["*"], # GET, POST, PUT, * = everything
    allow_headers = ["*"] # * = everything
)

app.include_router(portfolio.router, prefix=settings.API_PREFIX)
app.include_router(risk.router, prefix=settings.API_PREFIX)
app.include_router(stress.router, prefix=settings.API_PREFIX)
app.include_router(insights.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(market.router, prefix=settings.API_PREFIX)
app.include_router(stocks.router, prefix=settings.API_PREFIX)
app.include_router(stocks_financials.router, prefix=settings.API_PREFIX) 
app.include_router(password_reset.router, prefix=settings.API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)