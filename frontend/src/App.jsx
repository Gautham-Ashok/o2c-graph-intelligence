import { useState } from "react";
import GraphView from "./components/GraphView";
import ChatPanel from "./components/ChatPanel";

export default function App() {
  const [highlightIds, setHighlightIds] = useState([]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0e1a" }}>
      <GraphView highlightIds={highlightIds} />
      <ChatPanel onHighlight={(results) => {
        const ids = results
          .map((r) => Object.values(r)[0])
          .filter(Boolean)
          .map(String);
        setHighlightIds(ids);
      }} />
    </div>
  );
}