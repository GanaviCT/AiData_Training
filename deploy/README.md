# Trainlyft AI — Enterprise Deployment Operations Playbook

This playbook provides configuration details and instructions for deploying the Trainlyft AI Data Annotation Platform in production environments.

---

## Architecture Diagram

```mermaid
graph TD
    Client[Web Browser] -->|HTTP / HTTPS| ALB[AWS App Load Balancer / Nginx Ingress]
    ALB -->|Port 3000| FE[React Frontend Service]
    ALB -->|Port 8000 /api| BE[FastAPI Backend Service]
    
    subgraph Container Orchestration [ECS Fargate / Kubernetes Pods]
        FE
        BE
    end
    
    subgraph Data Tier [AWS Managed Services / K8s Database Tier]
        BE -->|SQL / Port 5432| RDS[(PostgreSQL Database)]
        BE -->|Cache / Queue / Port 6379| ElastiCache[(Redis Cache & Queue)]
        BE -->|NoSQL Logs / Port 27017| DocDB[(MongoDB / DocumentDB)]
    end
```

---

## 1. Local Deployment (Docker Compose Quickstart)

To run the full stack locally with all service engines and databases containerized:

### Prerequisite
* Docker & Docker Compose installed.

### Execution
1. Navigate to the root directory containing `docker-compose.yml`.
2. Spin up all containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
3. Verify running containers:
   ```bash
   docker compose ps
   ```
4. Access the platforms:
   - **Frontend UI**: `http://localhost:3000`
   - **FastAPI backend docs**: `http://localhost:8000/docs`
   - **MongoDB instance**: `mongodb://localhost:27017`
   - **PostgreSQL**: `postgresql://postgres:postgres123@localhost:5432/platform`

---

## 2. Infrastructure as Code (AWS Cloud Provisioning via Terraform)

The `deploy/terraform` directory sets up a Fargate cluster backed by secure managed databases.

### Prerequisites
* Terraform CLI (`>= 1.5.0`) installed.
* Configured AWS credentials (`aws configure` or env variables).

### Directory Files
- [provider.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/provider.tf): Configures AWS provider settings & default tag sets.
- [vpc.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/vpc.tf): Establishes public subnets, private app subnets, NAT gateways, and security groups.
- [ecs.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/ecs.tf): Provisions Fargate ECS cluster, log groups, task definitions, and Application Load Balancer.
- [rds.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/rds.tf): Sets up PostgreSQL RDS database instance.
- [elasticache.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/elasticache.tf): Provisions Redis cache instance.
- [documentdb.tf](file:///Users/ganavi/GANAVI/AiData/deploy/terraform/documentdb.tf): Provisions MongoDB-compatible DocumentDB cluster.

### Deploy Steps
1. Navigate to `deploy/terraform`:
   ```bash
   cd deploy/terraform
   ```
2. Initialize provider plugins and download modules:
   ```bash
   terraform init
   ```
3. Generate a deployment execution plan and verify changes:
   ```bash
   terraform plan -out=tfplan.binary
   ```
4. Apply the infrastructure:
   ```bash
   terraform apply tfplan.binary
   ```
5. Record output endpoints for configuration updates.

---

## 3. Kubernetes Deployment (EKS / Minikube Cluster)

The `deploy/kubernetes` directory contains declarative configurations for launching the platform inside a Kubernetes cluster.

### Prerequisites
* `kubectl` CLI installed.
* Active access to a Kubernetes cluster (`minikube`, `kind`, or AWS `EKS`).
* NGINX Ingress Controller installed in the cluster.

### Directory Manifests
- [namespace.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/namespace.yaml): Defines the `trainlyft-production` namespace.
- [secrets.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/secrets.yaml): Securely injects base64 encoded JWT secret keys and database passwords.
- [storage.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/storage.yaml): Claims persistent volume allocation for databases.
- [databases.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/databases.yaml): Deploys PostgreSQL, MongoDB, and Redis instances.
- [apps.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/apps.yaml): Launches React frontend and FastAPI backend microservices with liveness/readiness health probes.
- [ingress.yaml](file:///Users/ganavi/GANAVI/AiData/deploy/kubernetes/ingress.yaml): Configures NGINX ingress route mapping rules.

### Deployment Instructions
1. Apply the configurations:
   ```bash
   kubectl apply -f deploy/kubernetes/namespace.yaml
   kubectl apply -f deploy/kubernetes/secrets.yaml
   kubectl apply -f deploy/kubernetes/storage.yaml
   kubectl apply -f deploy/kubernetes/databases.yaml
   kubectl apply -f deploy/kubernetes/apps.yaml
   kubectl apply -f deploy/kubernetes/ingress.yaml
   ```
2. Monitor deployment rollouts:
   ```bash
   kubectl get pods -n trainlyft-production -w
   ```
3. Map host resolution locally for host `trainlyft.local`. Find the ingress external IP:
   ```bash
   kubectl get ingress -n trainlyft-production
   ```
   Add a line in `/etc/hosts`:
   ```text
   <INGRESS_IP_ADDRESS>  trainlyft.local
   ```
4. Access `http://trainlyft.local` in your web browser.
