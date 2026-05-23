terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Commented S3 Backend for production state tracking
  # backend "s3" {
  #   bucket         = "trainlyft-tf-state-bucket"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "trainlyft-tf-lock-table"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  description = "The target AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Application deployment environment (dev/staging/prod)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "The main project name"
  type        = string
  default     = "trainlyft-ai"
}
