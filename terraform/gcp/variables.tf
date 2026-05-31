variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run deployment"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "preleagl"
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for the application"
  type        = string
  sensitive   = true
  default     = ""
}

variable "clerk_publishable_key" {
  description = "Clerk publishable key — baked into the Docker image at build time"
  type        = string
  sensitive   = true
  default     = ""
}

variable "docker_image_tag" {
  description = "Tag for the Docker image"
  type        = string
  default     = "latest"
}

variable "clerk_jwks_url" {
  description = "Clerk JWKS URL used by the FastAPI backend to validate Clerk JWTs"
  type        = string
}

variable "db_password" {
  description = "Password for the Cloud SQL prelegal Postgres user"
  type        = string
  sensitive   = true
}
