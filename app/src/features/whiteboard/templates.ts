import { newId } from "../../lib/utils";
import type { WhiteboardElement } from "../../lib/types";

export interface WhiteboardTemplate {
  id: string;
  name: string;
  description: string;
  build: () => WhiteboardElement[];
}

const C = {
  primary: "#e4e4e7",
  accent: "#5db69b",
  info: "#6ea8fe",
  warn: "#e8b955",
  violet: "#a78bfa",
  pink: "#f2b8c6",
};

const id = () => newId();
// @ts-ignore - kept for template extensibility
const text = (x: number, y: number, str: string, fontSize = 14, color = C.primary): WhiteboardElement => ({
  id: id(), kind: "text", x, y, color, fontSize, text: str,
});
// @ts-ignore
const sticky = (x: number, y: number, str: string, w = 200, h = 60, color = C.warn): WhiteboardElement => ({
  id: id(), kind: "sticky", x, y, w, h, color, text: str,
});
const shape = (x: number, y: number, label: string, w = 190, h = 56, color = C.info, shapeType: "rect" | "roundedRect" | "diamond" | "ellipse" | "hexagon" | "cylinder" | "parallelogram" = "rect"): WhiteboardElement => ({
  id: id(), kind: "shape", shapeType, x, y, w, h, color, fill: true, strokeWidth: 2, label, labelColor: "#0f172a",
});
const boundary = (x: number, y: number, label: string, w: number, h: number, color = C.info): WhiteboardElement => ({
  id: id(), kind: "boundary", x, y, w, h, color, label,
});
const edge = (x1: number, y1: number, x2: number, y2: number, label = "", color = C.accent, sourceNodeId: string | null = null, targetNodeId: string | null = null): WhiteboardElement => ({
  id: id(), kind: "edge", x1, y1, x2, y2, color, width: 2, arrowhead: true, label, arrowStyle: "solid", dash: "solid", sourceNodeId, targetNodeId, sourcePort: null, targetPort: null,
});

// --- NEW TEMPLATES (Archify-aligned) ---

function architecture(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  // Boundaries
  const region = boundary(30, 60, "AWS ap-southeast-1 / production", 1360, 520, C.info);
  const priv = boundary(50, 140, "private subnet", 1240, 400, C.violet);
  els.push(region, priv);
  // Shapes - aligned like showcase arch (validated positions)
  const s1 = shape(80, 200, "Storefront", 150, 56, C.info);
  const s2 = shape(320, 200, "API Gateway", 150, 56, C.pink);
  const s3 = shape(560, 200, "Order Service", 150, 56, C.accent);
  const s4 = shape(560, 360, "Payment GW", 150, 56, C.warn);
  const s5 = shape(800, 200, "Inventory DB", 150, 56, C.violet);
  const s6 = shape(800, 340, "WMS", 150, 56, C.accent);
  const s7 = shape(1040, 200, "3PL Adapter", 150, 56, C.info);
  const s8 = shape(1040, 340, "JNE API", 150, 56, C.primary);
  els.push(s1, s2, s3, s4, s5, s6, s7, s8);
  // Edges - orthogonal, not through nodes
  els.push(edge(230, 228, 320, 228, "HTTPS", C.primary, s1.id, s2.id));
  els.push(edge(470, 228, 560, 228, "route", C.primary, s2.id, s3.id));
  els.push(edge(635, 256, 635, 340, "verify", C.warn, s3.id, s4.id));
  els.push(edge(710, 228, 800, 228, "check stock", C.info, s3.id, s5.id));
  els.push(edge(635, 300, 800, 368, "pack", C.accent, s3.id, s6.id));
  els.push(edge(950, 228, 1040, 228, "shipment", C.accent, s6.id, s7.id));
  els.push(edge(1115, 256, 1115, 340, "POST", C.primary, s7.id, s8.id));
  return els;
}

function workflow(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  // Lanes as boundaries
  els.push(boundary(40, 80, "Developer", 250, 430, C.info));
  els.push(boundary(320, 80, "AI Agent", 250, 430, C.warn));
  els.push(boundary(600, 80, "CLI / Validator", 250, 430, C.violet));
  els.push(boundary(880, 80, "Artifact", 250, 430, C.accent));
  // Shapes - main path 5 steps
  const n1 = shape(80, 150, "Prompt", 170, 56, C.primary);
  const n2 = shape(360, 150, "Write JSON IR", 170, 56, C.warn);
  const n3 = shape(640, 150, "Validate", 170, 56, C.violet);
  const n4 = shape(640, 280, "Render", 170, 56, C.info);
  const n5 = shape(920, 150, "Deliver HTML", 170, 56, C.accent);
  const n6 = shape(920, 280, "Preview", 170, 56, C.info);
  els.push(n1, n2, n3, n4, n5, n6);
  // Branch nodes
  const b1 = shape(640, 400, "Failed", 170, 56, C.pink);
  els.push(b1);
  // Edges
  els.push(edge(250, 178, 360, 178, "prompt", C.primary, n1.id, n2.id));
  els.push(edge(530, 178, 640, 178, "author", C.warn, n2.id, n3.id));
  els.push(edge(725, 206, 725, 280, "pass", C.violet, n3.id, n4.id));
  els.push(edge(810, 308, 920, 308, "compile", C.info, n4.id, n5.id));
  els.push(edge(1005, 206, 1005, 280, "watch", C.accent, n5.id, n6.id));
  els.push(edge(725, 336, 725, 400, "error", C.pink, n3.id, b1.id));
  els.push(edge(640, 428, 450, 428, "fix", C.pink, b1.id, n2.id));
  return els;
}

function sequence(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  // Participants as shapes at top
  const participants = ["Developer", "AI Agent", "CLI", "Schemas", "Renderers", "Output"];
  participants.forEach((label, i) => {
    const x = 80 + i * 200;
    const color = i===0? C.primary : i===3? C.warn : i===4? C.violet : C.info;
    els.push(shape(x, 80, label, 150, 56, color));
  });
  // Lifelines as vertical dashed edges
  participants.forEach((_, i) => {
    const x = 155 + i * 200;
    els.push(edge(x, 136, x, 520, "", C.primary));
    // @ts-ignore - set dash
    (els[els.length-1] as any).dash = "dashed";
    (els[els.length-1] as any).arrowhead = false;
  });
  // Messages as horizontal edges
  const msgs: Array<[number, number, number, string, string]> = [
    [155, 180, 355, "prompt", C.primary],
    [355, 220, 555, "write JSON", C.warn],
    [555, 260, 755, "validate", C.violet],
    [755, 300, 555, "ok/fail", C.warn],
    [555, 340, 955, "dispatch", C.accent],
    [955, 380, 1155, "HTML+SVG", C.info],
    [555, 420, 1155, "deliver", C.accent],
    [1155, 460, 155, "preview", C.info],
  ];
  msgs.forEach(([x1, y, x2, label, color]) => {
    els.push(edge(x1, y, x2, y, label, color));
  });
  return els;
}

function dataflow(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  // Stages as boundaries
  const stages = ["Sources", "Ingest", "Process", "Store", "Consume"];
  stages.forEach((label, i) => {
    const x = 40 + i * 260;
    els.push(boundary(x, 80, label, 240, 430, [C.info, C.warn, C.violet, C.accent, C.primary][i]!));
  });
  // Nodes
  const n1 = shape(70, 150, "Storefront", 180, 56, C.info);
  const n2 = shape(330, 150, "Order API", 180, 56, C.warn);
  const n3 = shape(590, 150, "Payment Verify", 180, 56, C.pink);
  const n4 = shape(590, 280, "WMS Events", 180, 56, C.violet);
  const n5 = shape(850, 150, "PII Vault", 180, 56, C.pink);
  const n6 = shape(850, 280, "Order DWH", 180, 56, C.accent);
  const n7 = shape(1110, 200, "3PL Feed", 180, 56, C.info);
  els.push(n1, n2, n3, n4, n5, n6, n7);
  // Flows
  els.push(edge(250, 178, 330, 178, "PII: alamat", C.warn, n1.id, n2.id));
  els.push(edge(510, 178, 590, 178, "tokenize", C.pink, n2.id, n3.id));
  els.push(edge(510, 220, 590, 308, "events", C.violet, n2.id, n4.id));
  els.push(edge(770, 178, 850, 178, "encrypted", C.pink, n3.id, n5.id));
  els.push(edge(770, 308, 850, 308, "curated", C.accent, n4.id, n6.id));
  els.push(edge(1030, 308, 1110, 228, "shipment", C.info, n6.id, n7.id));
  return els;
}

function lifecycle(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  // Main rail boundary
  els.push(boundary(40, 80, "Order Flow", 1100, 140, C.info));
  els.push(boundary(40, 260, "Waiting / 3PL", 700, 200, C.warn));
  els.push(boundary(40, 440, "Terminal", 500, 100, C.pink));
  // Main states
  const s1 = shape(80, 120, "Created", 120, 56, C.primary);
  const s2 = shape(280, 120, "Paid", 120, 56, C.accent);
  const s3 = shape(480, 120, "Packed", 120, 56, C.accent);
  const s4 = shape(680, 120, "Shipped", 120, 56, C.warn);
  const s5 = shape(880, 120, "Delivered", 120, 56, C.primary);
  els.push(s1, s2, s3, s4, s5);
  // Waiting
  const w1 = shape(480, 300, "Ready to Ship", 140, 56, C.warn);
  const w2 = shape(480, 380, "Out for Delivery", 140, 56, C.warn);
  els.push(w1, w2);
  // Failures
  const f1 = shape(280, 480, "Payment Failed", 140, 56, C.pink);
  const f2 = shape(300, 480, "3PL Rejected", 140, 56, C.pink);
  els.push(f1, f2);
  // Edges main rail
  els.push(edge(200, 148, 280, 148, "pay", C.accent, s1.id, s2.id));
  els.push(edge(400, 148, 480, 148, "pack", C.accent, s2.id, s3.id));
  els.push(edge(600, 148, 680, 148, "ship", C.warn, s3.id, s4.id));
  els.push(edge(800, 148, 880, 148, "POD", C.primary, s4.id, s5.id));
  // Edges waiting
  els.push(edge(540, 176, 540, 300, "", C.warn, s3.id, w1.id));
  els.push(edge(620, 328, 680, 176, "handover", C.warn, w1.id, s4.id));
  els.push(edge(740, 176, 550, 380, "", C.warn, s4.id, w2.id));
  els.push(edge(550, 408, 880, 148, "delivered", C.primary, w2.id, s5.id));
  // Failures
  els.push(edge(340, 176, 340, 480, "declined", C.pink, s2.id, f1.id));
  els.push(edge(350, 176, 350, 480, "rejected", C.pink, s3.id, f2.id));
  els.push(edge(420, 508, 420, 176, "revisi", C.accent, f2.id, s3.id));
  return els;
}

// --- WB-9: honest kanban + CI/CD starters (i18n names already exist) ---

function kanban(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  const cols: Array<[string, string]> = [
    ["Todo", C.warn],
    ["In Progress", C.info],
    ["Review", C.violet],
    ["Done", C.accent],
  ];
  cols.forEach(([label, color], i) => {
    els.push(boundary(40 + i * 270, 80, label, 250, 400, color));
  });
  const c1 = shape(70, 150, "Design review", 190, 56, C.warn);
  const c2 = shape(70, 230, "API contract", 190, 56, C.warn);
  const c3 = shape(340, 150, "Export menu", 190, 56, C.info);
  const c4 = shape(610, 150, "Rotate handle", 190, 56, C.violet);
  const c5 = shape(880, 150, "Undo history", 190, 56, C.accent);
  els.push(c1, c2, c3, c4, c5);
  return els;
}

function cicd(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  const n1 = shape(40, 200, "Commit", 150, 56, C.primary);
  const n2 = shape(270, 200, "Build", 150, 56, C.info);
  const n3 = shape(500, 200, "Test", 150, 56, C.warn);
  const n4 = shape(730, 200, "Approval", 150, 56, C.pink);
  const n5 = shape(960, 200, "Deploy", 150, 56, C.accent);
  els.push(n1, n2, n3, n4, n5);
  els.push(edge(190, 228, 270, 228, "push", C.primary, n1.id, n2.id));
  els.push(edge(420, 228, 500, 228, "artifacts", C.info, n2.id, n3.id));
  els.push(edge(650, 228, 730, 228, "pass", C.warn, n3.id, n4.id));
  els.push(edge(880, 228, 960, 228, "approve", C.pink, n4.id, n5.id));
  return els;
}

export const WHITEBOARD_TEMPLATES: WhiteboardTemplate[] = [
  { id: "blank", name: "Blank", description: "Empty canvas — start from scratch", build: () => [] },
  { id: "kanban", name: "Kanban", description: "Todo / In Progress / Review / Done columns", build: kanban },
  { id: "ci-cd", name: "CI/CD pipeline", description: "Commit → Build → Test → Approval → Deploy", build: cicd },
  { id: "architecture", name: "Architecture", description: "Services, DB, boundaries — for system maps", build: architecture },
  { id: "workflow", name: "Workflow", description: "Lanes & steps — for team handoffs", build: workflow },
  { id: "sequence", name: "Sequence", description: "Participants & messages — for API calls", build: sequence },
  { id: "dataflow", name: "Dataflow", description: "Stages & lineage — for PII & ETL", build: dataflow },
  { id: "lifecycle", name: "Lifecycle", description: "States & transitions — for order status", build: lifecycle },
];
