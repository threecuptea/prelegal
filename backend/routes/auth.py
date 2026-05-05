"""Auth routes: signup and signin."""

from __future__ import annotations

from fastapi import APIRouter

from models.auth import SigninRequest, SignupRequest, TokenResponse
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignupRequest) -> TokenResponse:
    account = await auth_service.signup(body.email, body.password)
    token = auth_service.create_token(account["id"], account["email"])
    return TokenResponse(access_token=token, email=account["email"])


@router.post("/signin", response_model=TokenResponse)
async def signin(body: SigninRequest) -> TokenResponse:
    account = await auth_service.signin(body.email, body.password)
    token = auth_service.create_token(account["id"], account["email"])
    return TokenResponse(access_token=token, email=account["email"])
