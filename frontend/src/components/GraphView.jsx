import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import axios from "axios";

const API = "https://o2c-graph-intelligence-production.up.railway.app";

const NODE_COLORS = {
  sales_order: "#3b82f6",
  customer: "#8b5cf6",
  so_item: "#06b6d4",
  product: "#10b981",
  delivery: "#f59e0b",
  billing: "#ef4444",
  payment: "#22c55e",
};

const NODE_RADIUS = {
  sales_order: 14,
  customer: 18,
  so_item: 9,
  product: 10,
  delivery: 12,
  billing: 12,
  payment: 11,
};

export default function GraphView() {
  const svgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/graph?limit=40`).then((res) => {
      setGraphData(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const { nodes: rawNodes, edges: rawEdges } = graphData;
    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || window.innerHeight;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Zoom + pan
    const g = svg.append("g");
    svg.call(
      d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Clone nodes for simulation
    const nodes = rawNodes.map((n) => ({ ...n }));
    const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const links = rawEdges
      .filter((e) => nodeById[e.source] && nodeById[e.target])
      .map((e) => ({ ...e, source: e.source, target: e.target }));

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(90).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (NODE_RADIUS[d.type] || 10) + 6));

    // Draw edges
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#1e3a5f")
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.7);

    // Edge labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 8)
      .attr("fill", "#475569")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");

    // Draw nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelected(d);
      });

    // Outer glow ring
    node.append("circle")
      .attr("r", (d) => (NODE_RADIUS[d.type] || 10) + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => NODE_COLORS[d.type] || "#64748b")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);

    // Main circle
    node.append("circle")
      .attr("r", (d) => NODE_RADIUS[d.type] || 10)
      .attr("fill", (d) => (NODE_COLORS[d.type] || "#64748b") + "33")
      .attr("stroke", (d) => NODE_COLORS[d.type] || "#64748b")
      .attr("stroke-width", 1.5);

    // Node label
    node.append("text")
      .text((d) => d.label.length > 16 ? d.label.slice(0, 14) + "…" : d.label)
      .attr("font-size", 9)
      .attr("fill", "#cbd5e1")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (NODE_RADIUS[d.type] || 10) + 12)
      .attr("pointer-events", "none");

    // Click on background → deselect
    svg.on("click", () => setSelected(null));

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      linkLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [graphData]);

  const legend = Object.entries(NODE_COLORS).map(([type, color]) => (
    <div key={type} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
      <svg width="12" height="12">
        <circle cx="6" cy="6" r="5" fill={color + "33"} stroke={color} strokeWidth="1.5" />
      </svg>
      <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "capitalize" }}>
        {type.replace(/_/g, " ")}
      </span>
    </div>
  ));

  return (
    <div style={{ flex: 1, height: "100vh", position: "relative", background: "#07090f" }}>
      {loading && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
          <span style={{ color: "#38bdf8", fontSize: "13px", marginTop: "12px" }}>Building graph...</span>
        </div>
      )}

      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />

      {/* Title */}
      <div style={styles.title}>
        <span style={{ color: "#475569", fontSize: "11px", letterSpacing: "0.1em" }}>MAPPING /</span>
        <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600, marginLeft: "6px" }}>Order to Cash</span>
      </div>

      {/* Legend */}
      <div style={styles.legend}>{legend}</div>

      {/* Node detail card */}
      {selected && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="10" height="10">
                <circle cx="5" cy="5" r="4"
                  fill={(NODE_COLORS[selected.type] || "#64748b") + "33"}
                  stroke={NODE_COLORS[selected.type] || "#64748b"}
                  strokeWidth="1.5" />
              </svg>
              <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 600 }}>
                {selected.type?.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
          </div>
          <div style={styles.cardBody}>
            {Object.entries(selected.data || {}).map(([k, v]) => (
              <div key={k} style={styles.cardRow}>
                <span style={styles.cardKey}>{k}</span>
                <span style={styles.cardVal}>{String(v).slice(0, 40)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: "absolute", inset: 0, background: "#07090f", zIndex: 10,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  },
  spinner: {
    width: 32, height: 32, border: "2px solid #1e2d40",
    borderTop: "2px solid #38bdf8", borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  title: {
    position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center",
    background: "#0d111acc", borderRadius: "6px",
    padding: "6px 14px", border: "1px solid #1e2d40",
  },
  legend: {
    position: "absolute", top: 60, left: 16,
    background: "#0d1117dd", border: "1px solid #1e2d40",
    borderRadius: "8px", padding: "12px 16px", zIndex: 5,
  },
  card: {
    position: "absolute", bottom: 20, left: 16, zIndex: 5,
    background: "#0d1117", border: "1px solid #1e3a5f",
    borderRadius: "10px", minWidth: "260px", maxWidth: "320px",
    boxShadow: "0 4px 24px #0008",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", borderBottom: "1px solid #1e2d40",
  },
  cardBody: { padding: "10px 14px", maxHeight: "200px", overflowY: "auto" },
  cardRow: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "6px" },
  cardKey: { fontSize: "11px", color: "#475569", flexShrink: 0 },
  cardVal: { fontSize: "11px", color: "#cbd5e1", textAlign: "right", wordBreak: "break-all" },
  closeBtn: {
    background: "transparent", border: "none", color: "#475569",
    cursor: "pointer", fontSize: "12px", padding: "2px 6px",
  },
};