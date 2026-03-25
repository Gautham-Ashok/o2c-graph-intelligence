import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function ChatPanel({ onHighlight }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello! Ask me anything about orders, deliveries, invoices, or payments.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");

    const newMessages = [...messages, { role: "user", text: question }];
    setMessages(newMessages);
    setLoading(true);

    // Build history for backend (last 6 messages, excluding the welcome message)
    const history = newMessages
      .slice(1)  // skip the initial greeting
      .slice(-6) // last 3 exchanges
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

    try {
      const res = await axios.post(`${API}/query`, { question, history });
      const { answer, sql, results } = res.data;
      setMessages((prev) => [...prev, { role: "assistant", text: answer, sql, results }]);
      if (results?.length && onHighlight) onHighlight(results);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Error connecting to backend." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.dot} /> O2C Query Interface
      </div>

      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? styles.userMsg : styles.botMsg}>
            <div style={styles.roleLabel}>{m.role === "user" ? "YOU" : "AI"}</div>
            <div style={styles.msgText}>{m.text}</div>
            {m.sql && (
              <details style={styles.sqlDetails}>
                <summary style={styles.sqlSummary}>SQL Query</summary>
                <pre style={styles.sqlCode}>{m.sql}</pre>
              </details>
            )}
            {m.results?.length > 0 && (
              <div style={styles.resultCount}>
                ↳ {m.results.length} rows returned
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={styles.botMsg}>
            <div style={styles.roleLabel}>AI</div>
            <div style={styles.thinking}>thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about orders, deliveries, invoices..."
          rows={2}
        />
        <button style={styles.sendBtn} onClick={send} disabled={loading}>
          {loading ? "..." : "→"}
        </button>
      </div>

      <div style={styles.examples}>
        <span style={styles.exLabel}>Try: </span>
        {[
          "Which products have the most billing documents?",
          "Show orders with no delivery",
          "Top 5 customers by order value",
        ].map((q) => (
          <button key={q} style={styles.chip} onClick={() => setInput(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: "420px",
    height: "100vh",
    background: "#0d1117",
    borderLeft: "1px solid #1e2d40",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #1e2d40",
    fontSize: "13px",
    color: "#38bdf8",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    letterSpacing: "0.05em",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
    display: "inline-block",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  userMsg: {
    background: "#1a2744",
    border: "1px solid #2563eb33",
    borderRadius: "8px",
    padding: "12px",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  botMsg: {
    background: "#111827",
    border: "1px solid #1e2d40",
    borderRadius: "8px",
    padding: "12px",
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  roleLabel: {
    fontSize: "10px",
    color: "#475569",
    marginBottom: "6px",
    letterSpacing: "0.1em",
  },
  msgText: {
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#cbd5e1",
  },
  thinking: {
    fontSize: "13px",
    color: "#475569",
    fontStyle: "italic",
  },
  sqlDetails: {
    marginTop: "8px",
  },
  sqlSummary: {
    fontSize: "11px",
    color: "#38bdf8",
    cursor: "pointer",
  },
  sqlCode: {
    fontSize: "11px",
    color: "#94a3b8",
    background: "#0a0e1a",
    padding: "8px",
    borderRadius: "4px",
    overflow: "auto",
    marginTop: "4px",
    whiteSpace: "pre-wrap",
  },
  resultCount: {
    fontSize: "11px",
    color: "#22c55e",
    marginTop: "6px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    padding: "12px 16px",
    borderTop: "1px solid #1e2d40",
  },
  input: {
    flex: 1,
    background: "#111827",
    border: "1px solid #1e2d40",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: "13px",
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0 16px",
    fontSize: "18px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  examples: {
    padding: "8px 16px 12px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
  },
  exLabel: {
    fontSize: "11px",
    color: "#475569",
  },
  chip: {
    fontSize: "11px",
    background: "transparent",
    border: "1px solid #1e2d40",
    borderRadius: "4px",
    color: "#64748b",
    padding: "2px 8px",
    cursor: "pointer",
  },
};