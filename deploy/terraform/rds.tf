# RDS DB Subnet Group
resource "aws_db_subnet_group" "db_subnet_group" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.isolated_db[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# RDS Security Group (Restricts access exclusively to ECS tasks)
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-sg-rds"
  description = "Access control for RDS PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg-rds"
  }
}

# PostgreSQL Database Instance
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-postgres"
  allocated_storage      = 20
  max_allocated_storage  = 100
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t4g.micro"
  db_name                = "platform"
  username               = var.rds_username
  password               = var.rds_password
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = true
  storage_encrypted      = true
  multi_az               = false

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# Variables for database credentials
variable "rds_username" {
  description = "Admin username for RDS PostgreSQL instance"
  type        = string
  default     = "db_admin"
}

variable "rds_password" {
  description = "Admin password for RDS PostgreSQL instance. Override this at runtime."
  type        = string
  sensitive   = true
  default     = "SuperSecurePassword123!"
}

# Outputs for connection references
output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "The connection endpoint for the RDS database"
}
