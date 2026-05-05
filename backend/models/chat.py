"""Pydantic models for the AI chat endpoint."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

MAX_MESSAGE_CHARS = 4_000
MAX_MESSAGES = 100


class PartyInfoExtraction(BaseModel):
    """Extracted party information."""

    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    noticeAddress: Optional[str] = None
    date: Optional[str] = None


class ChatResponse(BaseModel):
    """Structured response from AI containing the reply and extracted fields.

    Used as both the LLM structured-output schema and the API response.
    All document fields are optional to support incremental extraction.
    """

    # response="" default lets the frontend send the accumulated snapshot
    # back as `fields` without a reply text.
    response: str = ""

    # Document type detection
    documentType: Optional[str] = None
    suggestedDocument: Optional[str] = None

    # Common fields (shared across all document types)
    purpose: Optional[str] = None
    effectiveDate: Optional[str] = None
    governingLaw: Optional[str] = None
    jurisdiction: Optional[str] = None

    # Mutual NDA
    mndaTermType: Optional[Literal["expires", "continues"]] = None
    mndaTermYears: Optional[int] = None
    confidentialityTermType: Optional[Literal["years", "perpetuity"]] = None
    confidentialityTermYears: Optional[int] = None
    modifications: Optional[str] = None

    # Cloud Service Agreement
    providerName: Optional[str] = None
    customerName: Optional[str] = None
    subscriptionPeriod: Optional[str] = None
    technicalSupport: Optional[str] = None
    fees: Optional[str] = None
    paymentTerms: Optional[str] = None

    # Pilot Agreement
    pilotPeriod: Optional[str] = None
    evaluationPurpose: Optional[str] = None
    generalCapAmount: Optional[str] = None

    # Design Partner Agreement
    programName: Optional[str] = None
    feedbackRequirements: Optional[str] = None
    accessPeriod: Optional[str] = None

    # Service Level Agreement
    uptimeTarget: Optional[str] = None
    responseTimeCommitment: Optional[str] = None
    serviceCredits: Optional[str] = None

    # Professional Services Agreement
    deliverables: Optional[str] = None
    projectTimeline: Optional[str] = None
    paymentSchedule: Optional[str] = None
    ipOwnership: Optional[str] = None

    # Partnership Agreement
    partnershipScope: Optional[str] = None
    trademarkRights: Optional[str] = None
    revenueShare: Optional[str] = None

    # Software License Agreement
    licensedSoftware: Optional[str] = None
    licenseType: Optional[str] = None
    licenseFees: Optional[str] = None
    supportTerms: Optional[str] = None

    # Data Processing Agreement
    dataSubjects: Optional[str] = None
    processingPurpose: Optional[str] = None
    dataCategories: Optional[str] = None
    subprocessors: Optional[str] = None

    # Business Associate Agreement
    phiDescription: Optional[str] = None
    permittedUses: Optional[str] = None
    safeguards: Optional[str] = None

    # AI Addendum
    aiFeatures: Optional[str] = None
    trainingDataRights: Optional[str] = None
    outputOwnership: Optional[str] = None

    # Party information (common to all)
    party1: Optional[PartyInfoExtraction] = None
    party2: Optional[PartyInfoExtraction] = None

    isComplete: bool = False


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., max_length=MAX_MESSAGES)
    # The accumulated document state from the frontend; None on the first turn.
    fields: Optional[ChatResponse] = None
