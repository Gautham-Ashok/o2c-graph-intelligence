import os
import re
import psycopg2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from llm import generate_sql, generate_answer
from guardrails import is_valid_query
from graph_builder import build_graph

load_dotenv()

app = FastAPI(title="Dodge AI O2C Graph System")

# Allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST")
    )


class QueryRequest(BaseModel):
    question: str
    history: list = []  # list of {"role": "user/assistant", "content": "..."}


# ─────────────────────────────────────────
# ENDPOINT: Graph data for visualization
# ─────────────────────────────────────────
@app.get("/graph")
def get_graph(limit: int = 30):
    """Returns nodes and edges for the graph UI."""
    return build_graph(limit=limit)


# ─────────────────────────────────────────
# ENDPOINT: Chat / NL query
# ─────────────────────────────────────────
@app.post("/query")
def query(request: QueryRequest):
    question = request.question.strip()

    if not is_valid_query(question):
        return {
            "answer": "This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask about orders, deliveries, invoices, payments, or products.",
            "sql": None,
            "results": []
        }

    sql = generate_sql(question, request.history)

    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()
        results = [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        return {
            "answer": f"I was unable to execute the query. Error: {str(e)}",
            "sql": sql,
            "results": []
        }

    answer = generate_answer(question, sql, results)
    return {"answer": answer, "sql": sql, "results": results[:50]}