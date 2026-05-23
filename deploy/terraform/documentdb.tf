# DocumentDB Subnet Group
resource "aws_docdb_subnet_group" "docdb" {
  name       = "${var.project_name}-docdb-subnet-group"
  subnet_ids = aws_subnet.isolated_db[*].id

  tags = {
    Name = "${var.project_name}-docdb-subnet-group"
  }
}

# DocumentDB Security Group (Allows ingress exclusively from ECS tasks on port 27017)
resource "aws_security_group" "docdb" {
  name        = "${var.project_name}-sg-docdb"
  description = "Access control for AWS DocumentDB cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 27017
    to_port         = 27017
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
    Name = "${var.project_name}-sg-docdb"
  }
}

# DocumentDB Cluster
resource "aws_docdb_cluster" "docdb" {
  cluster_identifier      = "${var.project_name}-docdb-cluster"
  engine                  = "docdb"
  master_username         = var.docdb_username
  master_password         = var.docdb_password
  db_subnet_group_name    = aws_docdb_subnet_group.docdb.name
  vpc_security_group_ids  = [aws_security_group.docdb.id]
  skip_final_snapshot     = true
  storage_encrypted       = true

  tags = {
    Name = "${var.project_name}-docdb-cluster"
  }
}

# DocumentDB Cluster Instance
resource "aws_docdb_cluster_instance" "cluster_instances" {
  count              = 1
  identifier         = "${var.project_name}-docdb-instance-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.docdb.id
  instance_class     = "db.t3.medium"

  tags = {
    Name = "${var.project_name}-docdb-instance-${count.index + 1}"
  }
}

# Variables for DocumentDB Credentials
variable "docdb_username" {
  description = "DocumentDB cluster master username"
  type        = string
  default     = "mongo_admin"
}

variable "docdb_password" {
  description = "DocumentDB cluster master password. Override this at runtime."
  type        = string
  sensitive   = true
  default     = "SuperSecureMongoPassword123!"
}

# Output DocumentDB cluster endpoint
output "docdb_endpoint" {
  value       = aws_docdb_cluster.docdb.endpoint
  description = "The connection endpoint for the DocumentDB cluster"
}
