"""Auth routes: signup, signin, forgot/reset password."""

from __future__ import annotations

from fastapi import APIRouter

from models.auth import (
    ForgotPasswordRequest,
    MessageResponse,
    ResetPasswordRequest,
    SigninRequest,
    SignupRequest,
    TokenResponse,
)
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

_FORGOT_OK = "If an account with that email exists, a password reset link has been sent."
_RESET_OK = "Password updated successfully. You can now sign in with your new password."


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


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest) -> MessageResponse:
    await auth_service.forgot_password(body.email)
    return MessageResponse(message=_FORGOT_OK)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest) -> MessageResponse:
    await auth_service.reset_password(body.token, body.new_password)
    return MessageResponse(message=_RESET_OK)
