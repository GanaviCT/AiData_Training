# Trainlyft AI: Enterprise Data & ML Training Platform

Trainlyft AI is a premium, high-density, multi-tenant data annotation and machine learning platform. It supports collaborative human labeling (text, image, and video), quality assurance sampling, inter-annotator consensus diagnostics (Fleiss' Kappa), dynamic ML model training pipelines, and robust enterprise governance.

---

## 🛠️ Technology Stack & Languages

The platform is designed around a modern polyglot architecture combining relational databases, document stores, and in-memory caches.

### 💻 Frontend
* **Language:** TypeScript (63.7%)
* **Framework:** React 19 + Vite (Build System)
* **State Management:** Redux Toolkit (Slices for auth, tasks, annotations)
* **Styling:** Tailwind CSS + Vanilla CSS (Custom Glassmorphism design system supporting Light & Dark modes)
* **Key Integrations:** 
  * SheetJS (`xlsx`) for client-side CSV/Excel spreadsheet parsing & batch import previews.
  * Lucide React (Micro-icons).
  * Native HTML5 video player with sub-second range segment annotations.

### ⚙️ Backend
* **Language:** Python (30.3%)
* **Framework:** FastAPI (Asynchronous API gateway)
* **Machine Learning:** `scikit-learn` (Logistic Regression + CountVectorizer) for real-time model training on approved annotations.
* **Databases & Caching:**
  * **PostgreSQL:** Primary storage for users, tasks, annotations, and QA reviews (SQLAlchemy ORM).
  * **MongoDB:** Polyglot document store for compliance and system audit logs.
  * **Redis:** High-speed cache for statistics and dashboard charts with automatic in-memory dict fallbacks.
* **Security & Governance:**
  * Transparent AES-256 database encryption at rest (relational fields).
  * Multi-Factor Authentication (pyotp / TOTP MFA).
  * GDPR Compliance (PII Redaction filter + Account Anonymization & Right-to-be-Forgotten).
  * Backup Scheduler (daily database/mongodb automated snapshots to ZIP).

### 🚀 Infrastructure & DevOps
* **Containerization:** Docker & Docker Compose (Multi-stage builds, Nginx reverse proxy).
* **Orchestration:** Kubernetes Manifests (Postgres, MongoDB, Redis, Ingress routing, Volume Storage claims).
* **Infrastructure as Code (IaC):** Terraform modules provisioning AWS VPC, ECS Fargate, RDS (PostgreSQL), ElastiCache (Redis), and DocumentDB (MongoDB-compatible audit trail).

---

## 🏛️ Platform Architecture & Directory Structure

```text
├── Docx/                     # Technical specifications & Business Requirement Documents
├── backend/                  # FastAPI Python backend application
│   ├── app/
│   │   ├── core/             # Database connection singletons (SQL, Mongo, Redis) & encryption utilities
│   │   ├── models/           # SQLAlchemy schemas (User, Task, Annotation, QA)
│   │   ├── routers/          # API Route endpoints (MFA, GDPR, Training, Audit, Backup, QA)
│   │   ├── services/         # Business logic modules (Fleiss' Kappa, Ollama integration, backup workers)
│   │   └── main.py           # Application entry point
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Multi-stage container script for backend API
├── frontend/                 # Vite React TypeScript frontend application
│   ├── src/
│   │   ├── components/       # Header, Sidebar navigation panels
│   │   ├── pages/            # Core views (Dashboard, Task QA, Agreement IAA, Audit Logs, Settings)
│   │   ├── store/            # Redux configuration
│   │   └── index.css         # Styling system & Light/Dark variables
│   ├── package.json          # Node dependencies
│   └── Dockerfile            # Frontend compilation & Nginx distribution setup
├── deploy/                   # DevOps deployment manifests
│   ├── kubernetes/           # Production K8s pods, secrets, and ingress configs
│   └── terraform/            # Multi-AZ AWS provisioning scripts
└── docker-compose.yml        # Local quickstart configuration
```

---

## 🏎️ Local Quickstart Guide

### Prerequisite Services
Ensure PostgreSQL, MongoDB, and Redis are running locally or use Docker.

### 1. Backend Setup
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Configure your environment variables in `.env`.
3. Launch the API server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` to access the application.

---

## 🔒 Enterprise Features Included
* **Agreement Diagnostics (Fleiss' Kappa)**: Measure the categorical consensus rate among multi-worker annotations.
* **Audit Trail**: Real-time logging of administrative events and annotation modifications to MongoDB document store.
* **Automatic Backup / Recovery**: One-click download of daily server archives.
* **TOTP 2FA**: Standard Authenticator app integration.
