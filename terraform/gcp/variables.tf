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

variable "resend_api_key" {
  description = "Resend Email API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "docker_image_tag" {
  description = "Tag for the Docker image"
  type        = string
  default     = "latest"
}

# It's required a static IP and DNS record and possibly a loader balancer with SSL Certificate
# shooting for a domain like prelegal.threecuptea.com
# This is for the reset password link in the email. 
variable "app_base_url" {
  description = "The domain name for resetting password in the email"
  type        = string
  sensitive   = true
  default     = ""
}

# Remove hard code after we replace it with clerk
variable "jwt_secret" {
  description = "OpenRouter API key for the application"
  type        = string
  sensitive   = true
  default     = ""
}

# Clerk validation happens in Lambda, not at API Gateway level
variable "clerk_jwks_url" {
  description = "Clerk JWKS URL for JWT validation in Lambda"
  type        = string
}

variable "clerk_issuer" {
  description = "Clerk issuer URL (kept for Lambda environment)"
  type        = string
  default     = ""  # Not actually used but kept for backwards compatibility
}

variable "db_password" {
  description = "Password for the Cloud SQL prelegal Postgres user"
  type        = string
  sensitive   = true
}
