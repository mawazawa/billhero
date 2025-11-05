# Data Model: Neo4j Graph Database

This document defines the graph data model used in Neo4j to represent the relationships between people, communications, and legal cases. This model is the foundation for the application's ability to "triangulate" data and generate automated billing insights.

## 1. Node Labels (The "Nouns")

-   **`Attorney`**: The primary user of the system.
    -   **Properties:** `userId` (links to Supabase user), `name`, `email`
-   **`Person`**: Any individual involved in the legal matters.
    -   **Properties:** `name`, `email` (primary key), `phone`, `roles` (list, e.g., ["Client", "Opposing Counsel"])
-   **`Organization`**: A company or firm a person may belong to.
    -   **Properties:** `name`
-   **`Case`**: The central legal matter.
    -   **Properties:** `caseNumber` (primary key), `caseName`, `status`
-   **`Communication`**: A generic label for all interactions. We will use specific labels that inherit from this.
    -   **`Email`**:
        -   **Properties:** `messageId`, `threadId`, `subject`, `timestamp`, `summary`, `sourceGcsUrl`
    -   **`PhoneCall`**:
        -   **Properties:** `callId` (generated), `timestamp`, `durationSeconds`, `summary`, `sourceGcsUrl`
    -   **`Document`**:
        -   **Properties:** `documentId` (generated), `filename`, `docType` (e.g., "Motion", "Phone Bill", "Contract"), `timestamp`, `summary`, `sourceGcsUrl`
-   **`BillableEvent`**: An activity identified by the AI as potentially billable.
    -   **Properties:** `eventId` (generated), `description`, `timestamp`, `suggestedDurationHours`, `status` ("draft", "approved", "rejected"), `sourceType` ("Email", "PhoneCall")

## 2. Relationship Types (The "Verbs")

-   `(:Attorney)-[:**MANAGES**]->(:Case)`
-   `(:Attorney)-[:**REPRESENTS**]->(:Person)` (where Person has the "Client" role)
-   `(:Person)-[:**MEMBER_OF**]->(:Organization)`
-   `(:Person)-[:**SENT**]->(:Email)`
-   `(:Email)-[:**TO**]->(:Person)`
-   `(:Email)-[:**CC**]->(:Person)`
-   `(:Email)-[:**BCC**]->(:Person)`
-   `(:Person)-[:**PARTICIPATED_IN**]->(:PhoneCall)`
-   `(:Person)-[:**AUTHORED**]->(:Document)`
-   `(:Communication|Document)-[:**RELATES_TO**]->(:Case)` (Connects an interaction to a case)
-   `(:Communication|Document)-[:**GENERATED**]->(:BillableEvent)` (Crucially links the source activity to the billable event)
-   `(:BillableEvent)-[:**FOR_CASE**]->(:Case)` (Denormalized for faster billing queries)

## 3. Example Cypher Queries

**Query 1: Find all billable events for a specific case in a date range.**

```cypher
MATCH (c:Case {caseNumber: 'CV-2025-123'})<-[:FOR_CASE]-(be:BillableEvent)
WHERE be.timestamp >= datetime('2025-11-01') AND be.timestamp < datetime('2025-12-01')
AND be.status = 'draft'
RETURN be.description, be.suggestedDurationHours, be.timestamp
ORDER BY be.timestamp ASC
```

**Query 2: Show the full communication history with an opposing counsel for a specific case.**

```cypher
MATCH (p:Person {email: 'opposing.counsel@firm.com'})
MATCH (c:Case {caseNumber: 'CV-2025-123'})
MATCH (p)-[r]-(comm:Communication)-[:RELATES_TO]->(c)
RETURN comm.summary, comm.timestamp, type(r) as interactionType
ORDER BY comm.timestamp DESC
```
