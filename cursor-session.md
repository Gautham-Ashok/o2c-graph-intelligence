# AI Coding Session Log (Cursor)

## 🧠 Tool Used

* Cursor IDE (AI-assisted coding environment)
* OpenAI (for LLM integration in project)

---

## 📌 Project Overview

Built an **AI-powered O2C Graph Query System** that allows users to:

* Ask natural language questions
* Convert them into SQL using an LLM
* Query a PostgreSQL database
* Visualize relationships using a graph interface (D3.js)

---

## ⚙️ How AI Was Used

### 1. Code Generation & Structure

* Used Cursor AI to scaffold:

  * FastAPI backend (`main.py`)
  * Graph builder logic (`graph_builder.py`)
  * LLM integration (`llm.py`)
* Generated structured API endpoints:

  * `/query` → NL → SQL → Results
  * `/graph` → Graph data for visualization

---

### 2. Prompt Engineering

Used iterative prompts to improve SQL generation quality:

**Example Prompt Pattern:**

> "Convert this natural language question into PostgreSQL query using given schema. Ensure proper joins and aggregation."

**Refinements applied:**

* Added schema awareness
* Enforced casting (TEXT → NUMERIC)
* Controlled GROUP BY behavior

---

### 3. Debugging with AI

#### 🐞 Issue: SQL aggregation errors

* Problem: TEXT columns causing SUM() failure
* Fix (AI-assisted):

  * Applied `CAST(column AS NUMERIC)`

---

#### 🐞 Issue: Incorrect table joins

* Problem: Wrong relationships in SAP dataset
* Approach:

  * Provided sample JSONL data to AI
  * Asked AI to infer correct joins
* Result:

  * Correct mapping between:

    * billing → delivery → sales order

---

#### 🐞 Issue: Deployment failure (Railway)

* Problem: Backend couldn't detect app entry point
* Fix:

  * Added proper start command
  * Set root directory to `/backend`

---

#### 🐞 Issue: Database connection failure

* Problem: Localhost DB not accessible in cloud
* Fix:

  * Migrated to Railway PostgreSQL
  * Used `DATABASE_URL` environment variable

---

#### 🐞 Issue: Internal network resolution

* Problem: `railway.internal` not resolving
* Fix:

  * Used Railway **Variable Reference system**
  * Linked backend service to PostgreSQL service

---

#### 🐞 Issue: Graph API failing

* Problem: `graph_builder.py` using wrong DB config
* Fix:

  * Updated all DB connections to use `DATABASE_URL`

---

### 4. Iterative Development Pattern

Followed a loop:

1. Write feature (via AI suggestion)
2. Test locally
3. Encounter error
4. Provide logs to AI
5. Apply targeted fix
6. Repeat

---

### 5. Backend Optimization

* Limited query results (`results[:50]`)
* Added validation layer (`guardrails.py`)
* Handled exceptions gracefully with user-friendly messages

---

### 6. Deployment Strategy

* Backend → Railway (FastAPI)
* Database → Railway PostgreSQL
* Frontend → Vercel (React)

AI assisted in:

* Environment variable setup
* Debugging deployment logs
* Fixing networking issues

---

## 🔁 Iteration Examples

### Example 1

**User Input:**

> "Top 5 customers by order value"

**AI Contribution:**

```sql
SELECT "soldToParty",
SUM(CAST("totalNetAmount" AS NUMERIC)) AS total_order_value
FROM sales_order_headers
GROUP BY "soldToParty"
ORDER BY total_order_value DESC
LIMIT 5;
```

---

### Example 2

**User Input:**

> "Which products have the most billing documents?"

**AI Contribution:**

* Generated JOIN across billing tables
* Applied grouping and ordering logic

---

## 📊 AI Usage Summary

| Area                | AI Contribution |
| ------------------- | --------------- |
| Backend development | High            |
| SQL generation      | High            |
| Debugging           | High            |
| Deployment fixes    | High            |
| Data modeling       | Medium          |

---

## 💡 Key Learnings

* Importance of environment variables in production
* Difference between local vs cloud DB connections
* Handling LLM-generated SQL safely
* Debugging distributed systems (frontend + backend + DB)

---

## 🚀 Final Outcome

Successfully built and deployed:

* AI-powered query system
* Real-time graph visualization
* Fully cloud-hosted architecture

Live Demo:
👉 https://o2c-graph-intelligence.vercel.app/

---

## 🧾 Notes

* AI was used as a **collaborative assistant**, not a replacement
* All decisions, testing, and validation were done manually
* Iterative prompting significantly improved system quality

---
