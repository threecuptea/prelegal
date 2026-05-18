terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# Configure Google Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "cloudrun" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudsql" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

# Cloud SQL Postgres instance
resource "google_sql_database_instance" "main" {
  name             = "${var.service_name}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"
    backup_configuration {
      enabled = true
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.cloudsql]
}

resource "google_sql_database" "prelegal" {
  name     = "prelegal"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "prelegal" {
  name     = "prelegal"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# Dedicated service account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "${var.service_name}-sa"
  display_name = "Prelegal Cloud Run Service Account"
}

resource "google_project_iam_member" "cloud_run_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

locals {
  db_connection_name = "${var.project_id}:${var.region}:${google_sql_database_instance.main.name}"
  database_url       = "postgresql://prelegal:${var.db_password}@/prelegal?host=/cloudsql/${local.db_connection_name}"
}

# Configure Docker provider to use GCR
provider "docker" {
  registry_auth {
    address  = "${var.region}-docker.pkg.dev"
    username = "oauth2accesstoken"
    password = data.google_client_config.default.access_token
  }
}

# Get current project configuration
data "google_client_config" "default" {}

# Create Artifact Registry repository
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.service_name
  format        = "DOCKER"
  description   = "Docker repository for ${var.service_name}"
}

# Build Docker image
resource "docker_image" "app" {
  name = "${var.region}-docker.pkg.dev/${var.project_id}/${var.service_name}/${var.service_name}:${var.docker_image_tag}"

  build {
    context    = "${path.module}/../.."
    dockerfile = "Dockerfile"
    platform   = "linux/amd64"
    no_cache   = true
  }

  depends_on = [
    google_project_service.cloudbuild,
    google_artifact_registry_repository.app
  ]
}

# Push Docker image to Artifact Registry
resource "docker_registry_image" "app" {
  name = docker_image.app.name
  
  depends_on = [
    google_artifact_registry_repository.app,
    docker_image.app
  ]
}

# Deploy to Cloud Run
resource "google_cloud_run_service" "app" {
  name     = var.service_name
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.cloud_run.email

      containers {
        image = docker_image.app.name

        resources {
          limits = {
            cpu    = "1"
            memory = "2Gi"
          }
        }

        env {
          name  = "OPENROUTER_API_KEY"
          value = var.openrouter_api_key
        }

        env {
          name  = "RESEND_API_KEY"
          value = var.resend_api_key
        }

        env {
          name  = "JWT_SECRET"
          value = var.jwt_secret
        }

        env {
          name  = "APP_BASE_URL"
          value = var.app_base_url
        }

        env {
          name  = "CLERK_JWKS_URL"
          value = var.clerk_jwks_url
        }

        env {
          name  = "CLERK_ISSUER"
          value = var.clerk_issuer
        }

        env {
          name  = "DATABASE_URL"
          value = local.database_url
        }

        env {
          name  = "ENVIRONMENT"
          value = "production"
        }

        env {
          name  = "PYTHONUNBUFFERED"
          value = "1"
        }

        ports {
          container_port = 8000
        }
      }
    }

    metadata {
      annotations = {
        "run.googleapis.com/cloudsql-instances" = local.db_connection_name
        "autoscaling.knative.dev/minScale"      = "0"
        "autoscaling.knative.dev/maxScale"      = "1"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }


  depends_on = [
    google_project_service.cloudrun,
    docker_registry_image.app,
    google_sql_database.prelegal,
    google_sql_user.prelegal,
    google_project_iam_member.cloud_run_sql,
  ]
}

# Make the service publicly accessible
resource "google_cloud_run_service_iam_member" "public" {
  service  = google_cloud_run_service.app.name
  location = google_cloud_run_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" {
  value       = google_cloud_run_service.app.status[0].url
  description = "URL of the deployed Cloud Run service"
}

output "project_id" {
  value       = var.project_id
  description = "GCP Project ID"
}

output "region" {
  value       = var.region
  description = "GCP region"
}
