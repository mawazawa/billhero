# Project Tasks: Attorney Billing Automation Platform

This document outlines the development tasks for the project, broken down into sprints. 

## Sprint 1: Foundation & Core Ingestion Setup

- [X] **Task 1.1: Initialize Project & Documentation**
  - [X] Create initial documentation files (`ARCHITECTURE.md`, `DATA_MODEL.md`).

- [X] **Task 1.2: Clone `Inbox Zero` Repository**
  - [X] Cloned the `elie222/inbox-zero` repository to serve as the project foundation.

- [X] **Task 1.3: Install Dependencies**
  - [X] Run `pnpm install` to download all required packages.

- [X] **Task 1.4: Set Up Core Cloud Infrastructure**
  - [X] Create a new GCP Project (`billhero-attorney-billing`).
  - [X] Enable required APIs: Cloud Functions, Cloud Run, Cloud Storage, Document AI, Cloud Scheduler, Secret Manager, PubSub.
  - [X] Create a Supabase project and integrate custom models.
  - [X] Integrate Mistral OCR 2505 for PDF billing document processing.
  - [ ] Provision a Neo4j AuraDB instance.
  - [ ] Set up a Vercel project and link it to the repository.

- [X] **Task 1.5: Integrate `Inbox Zero` with Supabase**
  - [X] Update the Prisma schema in the `Inbox Zero` project to point to the Supabase PostgreSQL database.
  - [X] Run migrations to set up the initial tables including custom BillHero models.
  - [X] Test the connection and ensure `Inbox Zero` can write to Supabase.

- [X] **Task 1.6: Initial Commit & Push**
  - [X] Commit all the initial setup and configuration with clean git history.
  - [X] Push to GitHub repository (mawazawa/billhero).

## Sprint 2: Building the Processing Pipeline

- [ ] **Task 2.1: Create GCS Buckets**
  - [X] Create `gs://justiceos-data-staging-raw` for all incoming files.
  - [X] Create `gs://justiceos-data-staging-processed` for the output of OCR and NLP tasks.
  - [X] Buckets provisioned under JusticeOS Google account for resource sharing.

- [ ] **Task 2.2: Develop the GCS Orchestrator Function**
  - [ ] Write a Cloud Function that triggers on new files in the `raw-data` bucket.
  - [ ] Implement the routing logic to push messages to Pub/Sub topics (`ocr-processing-queue`, `nlp-processing-queue`).

- [ ] **Task 2.3: Develop the OCR Service**
  - [ ] Write a Cloud Function triggered by `ocr-processing-queue`.
  - [ ] Integrate with Google's Document AI API.
  - [ ] The function should read a PDF from GCS, send it to Document AI, and save the structured text output to the `processed-data` bucket.

- [ ] **Task 2.4: Set up Vercel AI Gateway**
  - [ ] Create an AI Gateway instance in Vercel.
  - [ ] Configure it with API keys for Mistral and/or OpenAI, storing keys in Vercel's secure environment variables.

## Sprint 3: AI Enrichment and Graph Integration

- [ ] **Task 3.1: Develop the NLP Enrichment Service**
  - [ ] Create a FastAPI service to be deployed on Cloud Run.
  - [ ] This service will be triggered by messages on the `nlp-processing-queue`.
  - [ ] It will read the text file (from email or OCR), and call the AI model via the Vercel AI Gateway endpoint.
  - [ ] Implement the prompt engineering to extract entities, classify communications, and identify billable events.
  - [ ] The service will then publish the final enriched JSON to the `graph-ingestion-queue`.

- [ ] **Task 3.2: Develop the Graph Ingestion Service**
  - [ ] Write a Cloud Function triggered by `graph-ingestion-queue`.
  - [ ] It will connect to Neo4j AuraDB (credentials from Secret Manager).
  - [ ] Implement the Cypher queries (`MERGE`) to populate the graph based on the data model.

- [ ] **Task 3.3: Implement File Uploads**
  - [ ] Build the UI component in the Next.js app for file uploads (e.g., phone bills).
  - [ ] Create a Next.js API route that generates a signed URL for direct-to-GCS uploads.

## Sprint 4: Backend API and Frontend UI for Billing

- [ ] **Task 4.1: Build the Billing API Endpoints**
  - [ ] Create the `/api/billing/generate-draft` API route in Next.js.
  - [ ] This endpoint will query Neo4j for billable events for a given case and date range.
  - [ ] Create the `/api/billing/save-bill` API route to persist the final bill in Supabase.

- [ ] **Task 4.2: Develop the Billing Center UI**
  - [ ] Create the frontend pages and components in Next.js/React.
  - [ ] Build the interface for generating a draft bill.
  - [ ] Create an editable table to display, modify, and approve line items.
  - [ ] Connect the UI to the backend API endpoints.

## 🔍 Infrastructure Research & Decision Matrix

### ✅ **DECISION MADE: Mistral OCR 2505**
- **Status**: CONFIRMED (100% sure per user research)
- **API Key**: `hC1LYTQD1in75X9JJG3ddegojXas99i5`
- **Capability**: Advanced document understanding with text, images, tables, equations
- **Advantage**: Superior to Google Document AI for legal/billing documents

### ❌ **DECISION: REJECTED FiveTran Gmail Integration**
**Critical Blocker**: FiveTran Email Connector only supports CSV/JSON files, **NOT PDF attachments**
- **BillHero Requirement**: PDF billing documents (attorney bills, phone bills, invoices)
- **FiveTran Limitation**: Cannot extract PDF attachments from Gmail
- **Impact**: Cannot replace custom Gmail → Document AI pipeline

### 🤔 **FiveTran Alternative: Structured Data Movement Only**
**Potential Use Case**: GCS → Supabase data movement after OCR processing

```text
Gmail → Custom Webhook → Mistral OCR → FiveTran → GCS → Supabase
```

**Trial Strategy**: Test FiveTran GCS → Supabase integration (2-week trial available)

### 📊 **Final Architecture Decision**
1. **Keep Custom Gmail Integration** for PDF attachment extraction
2. **Switch to Mistral OCR 2505** for document processing
3. **Evaluate FiveTran** for structured data movement (GCS → Supabase)
4. **Maintain GCP Infrastructure** for core processing pipeline

### 🔑 **Credentials Added**
- Mistral OCR API key secured and ready for integration
- FiveTran trial available for structured data testing

**Next**: Update architecture docs to reflect Mistral OCR integration and proceed with infrastructure setup.
