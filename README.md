# O2C Graph Intelligence

An interactive graph visualization and AI-powered query system for SAP Order-to-Cash (O2C) data. Built for the Forward Deployed Engineer assignment.

**Live Demo:** [o2c-graph-intelligence.vercel.app](https://o2c-graph-intelligence.vercel.app)

---

## What It Does

Business O2C data spans multiple disconnected tables — sales orders, deliveries, invoices, payments. This system unifies that fragmented data into an interactive graph and lets users query it in plain English.

- Visualize the full O2C flow as an interactive graph: Customer → Sales Order → Delivery → Invoice → Journal Entry → Payment
- Ask natural language questions and get data-backed answers
- Matched entities from query results are highlighted on the graph in real time
- Guardrails prevent off-topic questions — the system only answers queries about the dataset

---

## Architecture

```
Frontend (React + D3.js)      →    Vercel
       ↓
Backend (FastAPI + Python)    →    Railway
       ↓
PostgreSQL                    →    Railway
```

### Frontend
- **React** with **D3.js** for force-directed graph rendering
- Nodes are color-coded by entity type (sales order, customer, delivery, billing, payment, etc.)
- Drag, zoom, and pan supported on the graph
- Click any node to inspect its metadata
- Chat panel with conversation history and example queries
- Query results highlight matching nodes on the graph (yellow ring)

### Backend
- **FastAPI** — two endpoints: `/graph` for graph data, `/query` for NL queries
- `/graph` builds the node/edge structure by joining across 6+ PostgreSQL tables
- `/query` runs the full NL → SQL → DB → NL answer pipeline
- CORS enabled for Vercel frontend

### Database
**PostgreSQL** on Railway. The SAP O2C dataset was loaded into 16 normalized tables matching the original SAP structure:

| Table | Description |
|---|---|
| `sales_order_headers` | Sales order master data |
| `sales_order_items` | Line items per order |
| `outbound_delivery_headers` | Delivery documents |
| `outbound_delivery_items` | Delivery line items, linked back to sales orders |
| `billing_document_headers` | Invoice/billing master |
| `billing_document_items` | Billing line items, linked to delivery documents |
| `payments_accounts_receivable` | Payment clearing records |
| `journal_entry_items_accounts_receivable` | Accounting journal entries |
| `business_partners` | Customer master data |
| `products`, `product_descriptions` | Material/product catalog |
| `plants` | Plant/warehouse master |
| + 4 more supporting tables | |

**Why PostgreSQL over a graph DB (e.g. Neo4j)?**

The dataset is relational SAP data with well-defined foreign key relationships. PostgreSQL handles the join paths efficiently, keeps the deployment simple (one service on Railway), and lets the LLM generate standard SQL which is easier to validate and debug than Cypher. A graph DB would add operational complexity without meaningful query performance gains at this data scale.

---

## Graph Modeling

### Nodes
| Type | Color | Represents |
|---|---|---|
| `customer` | Purple | Sold-to party (business partner) |
| `sales_order` | Blue | SAP sales order header |
| `so_item` | Cyan | Individual line item on a sales order |
| `product` | Green | Material/product |
| `delivery` | Amber | Outbound delivery document |
| `billing` | Red | Billing/invoice document |
| `payment` | Green | Payment clearing entry |
| `journal` | (gray) | Accounting journal entry |

### Edges (Relationships)
```
customer      → placed        → sales_order
sales_order   → has item      → so_item
so_item       → is material   → product
sales_order   → delivered via → delivery
delivery      → billed as     → billing
billing       → journal entry → journal
billing       → paid via      → payment
```

### Key JOIN Paths
The graph builder resolves these relationships using the correct SAP foreign key paths:
- `outbound_delivery_items.referenceSdDocument` → `sales_order_headers.salesOrder`
- `billing_document_items.referenceSdDocument` → `outbound_delivery_headers.deliveryDocument`
- `payments_accounts_receivable.salesDocument` → `sales_order_headers.salesOrder`
- `journal_entry_items.referenceDocument` → `billing_document_headers.billingDocument`

---

## LLM Integration & Prompting Strategy

### Model
GPT-4o via OpenAI API — used for both SQL generation and answer synthesis.

### Two-step pipeline

**Step 1 — SQL Generation (`generate_sql`)**

The prompt includes:
1. Full DB schema with all 16 tables and their columns
2. Explicit JOIN paths — these are injected directly because the LLM cannot infer SAP foreign key conventions from column names alone
3. A rule to cast all columns to `NUMERIC` before aggregation (all SAP values are stored as TEXT)
4. Instruction to use double-quoted identifiers exactly as defined
5. Last 6 messages of conversation history for follow-up resolution

Temperature is set to `0` — SQL generation requires deterministic output.

**Step 2 — Answer Generation (`generate_answer`)**

A separate prompt receives the original question, the SQL that ran, and up to 20 rows of results. The model is instructed to answer only from the data and keep it concise. Temperature is `0.2` for slight natural variation in phrasing.

### Why two separate calls?
Combining SQL generation and answer synthesis in one prompt caused the model to sometimes skip execution or hallucinate results. Separating them enforces that the answer is always grounded in real query output.

### Conversation Memory
The last 3 user/assistant exchanges are passed as message history on every request. This allows follow-up queries like "tell me more about that customer" to resolve correctly.

---

## Guardrails

Implemented in `guardrails.py` using a two-layer approach:

**Layer 1 — Blocklist**
Explicit out-of-scope phrases are rejected immediately:
- `"write a poem"`, `"tell me a joke"`, `"what is the capital"`, `"recipe"`, `"weather"`, etc.

**Layer 2 — Domain allowlist**
The question must contain at least one domain keyword to proceed:
- `order`, `sales`, `invoice`, `billing`, `delivery`, `product`, `payment`, `customer`, `material`, `plant`, `journal`, `document`, `account`, `receivable`, `shipment`, etc.

Questions that pass neither check receive:
> "This system is designed to answer questions related to the SAP Order-to-Cash dataset only."

This approach is lightweight, fast (no extra LLM call), and effective for the domain.

---

## Example Queries

| Query | What it does |
|---|---|
| Which products have the most billing documents? | Aggregates billing items by material |
| Trace the full flow of billing document 90504204 | Joins SO → delivery → billing → journal |
| Show sales orders with no delivery | LEFT JOIN with NULL check on delivery |
| Top 5 customers by order value | SUM with GROUP BY on soldToParty |
| Show orders with no payment | LEFT JOIN payments with NULL filter |

---

## Bonus Features Implemented

- **Node highlighting** — query results highlight matching nodes on the graph with a yellow ring
- **Conversation memory** — last 3 exchanges passed as history for follow-up queries
- **NL to SQL** — dynamic SQL generation, not pre-written queries
- **SQL transparency** — expandable "SQL Query" section shown per chat response
- **Guardrails** — domain-restricted query handling

---

## Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt

# Create .env
echo "DATABASE_URL=your_postgres_url" > .env
echo "OPENAI_API_KEY=your_openai_key" >> .env

uvicorn main:app --reload --port 8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Update the `API` constant in `GraphView.jsx` and `ChatPanel.jsx` to `http://localhost:8080` for local development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, D3.js, Vite, Axios |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL |
| LLM | OpenAI GPT-4o |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

---

## Project Structure

```
o2c-graph-intelligence/
├── backend/
│   ├── main.py              # FastAPI app, /graph and /query endpoints
│   ├── graph_builder.py     # Builds nodes + edges from PostgreSQL joins
│   ├── llm.py               # SQL generation and answer synthesis (GPT-4o)
│   ├── guardrails.py        # Domain keyword filtering
│   ├── load_data.py         # Data ingestion script
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── GraphView.jsx    # D3.js force graph
    │   │   └── ChatPanel.jsx    # Chat interface
    │   └── index.css
    └── package.json
```
