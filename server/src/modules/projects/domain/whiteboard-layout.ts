import { randomUUID } from "node:crypto";
import { LIMITS, type WhiteboardElement } from "./state.js";

/**
 * Constrained layout assistant for sequence diagrams (bukan auto-layout
 * generik). Rujukan angka dan aturan:
 * - Geometri kolom dari template kanvas (`app/.../whiteboard/templates.ts`
 *   `sequence()`: box 150x56 di y=80, pitch 200, lifeline y136+).
 * - Disiplin dari Archify (`archify/renderers/sequence/README.md` +
 *   `references/authoring-contract.md`): partisipan terurut, waktu ke
 *   bawah, spasi vertikal >=28px, span panah >=60px, varian return/async
 *   untuk makna, tanpa Port Spread untuk sequence.
 * Adaptasi: `dashed` milik lifeline (dikecualikan validator showcase),
 * return/async memakai `dotted`; tanpa activations/segments/column-spread
 * (mesin belum ada).
 */

export const SEQUENCE_PARTICIPANT_W = 150;
export const SEQUENCE_PARTICIPANT_H = 56;
export const SEQUENCE_PARTICIPANT_Y = 80;
export const SEQUENCE_COLUMN_PITCH = 200;
export const SEQUENCE_FIRST_COLUMN_X = 80;
export const SEQUENCE_LIFELINE_TOP = 136;
export const SEQUENCE_FIRST_MESSAGE_Y = 180;
export const SEQUENCE_MESSAGE_STEP = 40;
export const SEQUENCE_MIN_ARROW_SPAN = 60;
export const SEQUENCE_MIN_MESSAGE_GAP = 28;
export const SEQUENCE_MAX_PARTICIPANTS = 12;
export const SEQUENCE_MAX_MESSAGES = 200;
export const SEQUENCE_MAX_ACTIVATIONS = 50;
export const SEQUENCE_MAX_PHASES = 10;
/** Self-message loop: out-and-back pair, back edge 30px below (gap rule kept). */
export const SEQUENCE_SELF_BACK_DY = 30;
export const SEQUENCE_SELF_ADVANCE = 70;
/** Self loop starts just right of the lifeline bar and widens to fit the label. */
export const SEQUENCE_SELF_GAP = 10;
export const SEQUENCE_SELF_MAX_W = 170;
/** Gap vertikal tambahan antar fase (band terpisah bersih, bukan tumpuk). */
export const SEQUENCE_PHASE_GAP = 80;
/** Padding band fase dari pesan terluar (24px → gap visual ~30px). */
export const SEQUENCE_BAND_PAD = 24;
/** Activation bar width + vertical margin around covered messages. */
export const SEQUENCE_ACTIVATION_W = 14;
export const SEQUENCE_ACTIVATION_PAD_Y = 20;

/** Cycle warna partisipan (7 warna kanvas yang terbaca di putih). */
const PARTICIPANT_COLORS = [
  "#2563eb",
  "#e8b955",
  "#0f766e",
  "#8b5cf6",
  "#db2777",
  "#047857",
  "#374151",
];

export type SequenceMessageVariant = "call" | "return" | "async" | "security";

export interface SequenceMessageInput {
  /** Index partisipan pengirim (0-based). */
  from: number;
  /** Index partisipan penerima (0-based). */
  to: number;
  /** Label pesan — wajib non-kosong (label adalah data semantik). */
  label: string;
  variant?: SequenceMessageVariant;
}

export interface SequenceParticipantInput {
  name: string;
  /** Second line under the name (role, e.g. "mobile app"). Rendered via newline. */
  sub?: string;
}

export interface SequenceActivationInput {
  /** Participant index owning the lifeline. */
  participant: number;
  /** Message indexes (0-based into messages[]) the bar spans. */
  fromMessage: number;
  toMessage: number;
}

export interface SequencePhaseInput {
  label: string;
  fromMessage: number;
  toMessage: number;
}

export interface SequenceLayoutInput {
  /** Participants in story order (2..12). Plain string or {name, sub?}. */
  participants: Array<string | SequenceParticipantInput>;
  messages: SequenceMessageInput[];
  /** Activation bars on lifelines (rects, no new semantics). */
  activations?: SequenceActivationInput[];
  /** Phase bands (boundaries). First band auto-extends to y=60 to cover participants. */
  phases?: SequencePhaseInput[];
}

export interface SequenceLayoutResult {
  elements: WhiteboardElement[];
  /** Lebar/tinggi diagram (termasuk baris legend). */
  width: number;
  height: number;
  legendY: number;
}

export class SequenceLayoutError extends Error {}

function fail(message: string): never {
  throw new SequenceLayoutError(message);
}

export function layoutSequence(input: SequenceLayoutInput): SequenceLayoutResult {
  const rawParticipants = input.participants ?? [];
  const messages = input.messages ?? [];
  const activations = input.activations ?? [];
  const phases = input.phases ?? [];
  if (rawParticipants.length < 2) fail("Sequence needs at least 2 participants");
  if (rawParticipants.length > SEQUENCE_MAX_PARTICIPANTS) {
    fail(`Too many participants (${rawParticipants.length} > ${SEQUENCE_MAX_PARTICIPANTS}) — split into focused diagrams`);
  }
  const names = rawParticipants.map((p, i) => {
    const name = typeof p === "string" ? p : p?.name;
    if (typeof name !== "string" || name.trim() === "") fail(`Participant ${i} needs a non-empty name`);
    const sub = typeof p === "object" && p !== null && typeof p.sub === "string" && p.sub.trim() !== "" ? p.sub.trim() : null;
    return sub ? `${(name as string).trim()}\n${sub}` : (name as string).trim();
  });
  if (messages.length > SEQUENCE_MAX_MESSAGES) {
    fail(`Too many messages (${messages.length} > ${SEQUENCE_MAX_MESSAGES})`);
  }
  messages.forEach((m, i) => {
    if (!Number.isInteger(m.from) || m.from < 0 || m.from >= names.length) {
      fail(`Message ${i}: 'from' must be a participant index 0..${names.length - 1}`);
    }
    if (!Number.isInteger(m.to) || m.to < 0 || m.to >= names.length) {
      fail(`Message ${i}: 'to' must be a participant index 0..${names.length - 1}`);
    }
    if (typeof m.label !== "string" || m.label.trim() === "") {
      fail(`Message ${i}: 'label' is required (labels are semantic data)`);
    }
    if (m.from === m.to) return; // self-message: out-and-back pair, checked below
    const x1 = SEQUENCE_FIRST_COLUMN_X + m.from * SEQUENCE_COLUMN_PITCH + SEQUENCE_PARTICIPANT_W / 2;
    const x2 = SEQUENCE_FIRST_COLUMN_X + m.to * SEQUENCE_COLUMN_PITCH + SEQUENCE_PARTICIPANT_W / 2;
    if (Math.abs(x2 - x1) < SEQUENCE_MIN_ARROW_SPAN) {
      fail(`Message ${i} ("${m.label}"): arrow span too short — place sender and receiver in different columns`);
    }
  });
  if (activations.length > SEQUENCE_MAX_ACTIVATIONS) fail(`Too many activations (>${SEQUENCE_MAX_ACTIVATIONS})`);
  activations.forEach((a, i) => {
    if (!Number.isInteger(a.participant) || a.participant < 0 || a.participant >= names.length) {
      fail(`Activation ${i}: 'participant' must be an index 0..${names.length - 1}`);
    }
    if (!Number.isInteger(a.fromMessage) || !Number.isInteger(a.toMessage) || a.fromMessage < 0 || a.toMessage >= messages.length || a.fromMessage > a.toMessage) {
      fail(`Activation ${i}: message range must satisfy 0 <= fromMessage <= toMessage < ${messages.length}`);
    }
  });
  if (phases.length > SEQUENCE_MAX_PHASES) fail(`Too many phases (>${SEQUENCE_MAX_PHASES})`);
  phases.forEach((p, i) => {
    if (typeof p.label !== "string" || p.label.trim() === "") fail(`Phase ${i} needs a non-empty label`);
    if (!Number.isInteger(p.fromMessage) || !Number.isInteger(p.toMessage) || p.fromMessage < 0 || p.toMessage >= messages.length || p.fromMessage > p.toMessage) {
      fail(`Phase ${i}: message range must satisfy 0 <= fromMessage <= toMessage < ${messages.length}`);
    }
  });

  const raw: Array<Record<string, unknown>> = [];
  const colCenter = (i: number) => SEQUENCE_FIRST_COLUMN_X + i * SEQUENCE_COLUMN_PITCH + SEQUENCE_PARTICIPANT_W / 2;
  names.forEach((label, i) => {
    raw.push({
      id: randomUUID(),
      kind: "shape",
      shapeType: "rect",
      x: SEQUENCE_FIRST_COLUMN_X + i * SEQUENCE_COLUMN_PITCH,
      y: SEQUENCE_PARTICIPANT_Y,
      w: SEQUENCE_PARTICIPANT_W,
      h: SEQUENCE_PARTICIPANT_H,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
      label,
    });
  });
  // Message rows first (y cursor advances extra for self-message pairs),
  // so activations and phases can reference them by index.
  const msgY: number[] = [];
  let cursor = SEQUENCE_FIRST_MESSAGE_Y;
  const msgSelf: boolean[] = [];
  // Phase index per message (-1 = outside any phase) for gap insertion.
  const msgPhase: number[] = messages.map(() => -1);
  phases.forEach((p, pi) => {
    for (let i = p.fromMessage; i <= p.toMessage; i += 1) {
      if (msgPhase[i] === -1) msgPhase[i] = pi;
    }
  });
  messages.forEach((m, i) => {
    msgY.push(cursor);
    if (m.from === m.to) {
      msgSelf.push(true);
      cursor += SEQUENCE_SELF_ADVANCE;
    } else {
      msgSelf.push(false);
      cursor += SEQUENCE_MESSAGE_STEP;
    }
    // Inter-phase gap so bands separate cleanly instead of overlapping.
    const nextPhase = i + 1 < messages.length ? msgPhase[i + 1] : -2;
    if (msgPhase[i] !== -1 && nextPhase !== -1 && nextPhase !== -2 && nextPhase !== msgPhase[i]) {
      cursor += SEQUENCE_PHASE_GAP;
    }
  });
  const lifelineBottom = (messages.length > 0 ? cursor - SEQUENCE_MESSAGE_STEP : SEQUENCE_FIRST_MESSAGE_Y) + 60;
  names.forEach((_, i) => {
    raw.push({
      id: randomUUID(),
      kind: "edge",
      x1: colCenter(i),
      y1: SEQUENCE_LIFELINE_TOP,
      x2: colCenter(i),
      y2: lifelineBottom,
      color: "#8b5cf6",
      width: 2,
      arrowhead: false,
      arrowStyle: "none",
      dash: "dashed",
      label: "",
    });
  });
  messages.forEach((m, i) => {
    const variant: SequenceMessageVariant = m.variant ?? "call";
    const y = msgY[i]!;
    const dash = variant === "call" || variant === "security" ? "solid" : "dotted";
    const color =
      variant === "security"
        ? "#db2777"
        : variant === "call"
          ? (PARTICIPANT_COLORS[m.from % PARTICIPANT_COLORS.length] as string)
          : "#8b5cf6";
    const base = {
      color,
      width: 2,
      arrowhead: true,
      arrowStyle: "solid",
      dash,
      label: m.label.trim(),
    };
    if (msgSelf[i]) {
      // Self-message: out-and-back pair sized to its label (labels render
      // centered, so the loop must clear the lifeline bar it starts from).
      // Margin covers 16px labels; longer labels fail closed with a clear
      // message (shorten wording, preserve meaning).
      const cx = colCenter(m.from);
      const w = Math.min(SEQUENCE_SELF_MAX_W, Math.max(60, m.label.trim().length * 10 + 48));
      const x0 = cx + SEQUENCE_SELF_GAP;
      raw.push({ id: randomUUID(), kind: "edge", x1: x0, y1: y, x2: x0 + w, y2: y, ...base });
      raw.push({ id: randomUUID(), kind: "edge", x1: x0 + w, y1: y + SEQUENCE_SELF_BACK_DY, x2: x0, y2: y + SEQUENCE_SELF_BACK_DY, ...base, label: "" });
    } else {
      raw.push({
        id: randomUUID(),
        kind: "edge",
        x1: colCenter(m.from),
        y1: y,
        x2: colCenter(m.to),
        y2: y,
        ...base,
      });
    }
  });
  activations.forEach((a) => {
    const cx = colCenter(a.participant);
    const top = msgY[a.fromMessage]! - SEQUENCE_ACTIVATION_PAD_Y;
    const bottom = msgY[a.toMessage]! + (msgSelf[a.toMessage] ? SEQUENCE_SELF_BACK_DY : 0) + SEQUENCE_ACTIVATION_PAD_Y;
    raw.push({
      id: randomUUID(),
      kind: "shape",
      shapeType: "rect",
      x: cx - SEQUENCE_ACTIVATION_W / 2,
      y: top,
      w: SEQUENCE_ACTIVATION_W,
      h: Math.max(20, bottom - top),
      color: PARTICIPANT_COLORS[a.participant % PARTICIPANT_COLORS.length],
      fill: "solid",
      label: "",
    });
  });
  const boardRight = SEQUENCE_FIRST_COLUMN_X + (names.length - 1) * SEQUENCE_COLUMN_PITCH + SEQUENCE_PARTICIPANT_W;
  let bandsEnd = lifelineBottom;
  phases.forEach((p, i) => {
    // First band auto-extends upward to cover participants (containment rule).
    const top = i === 0 ? Math.min(60, msgY[p.fromMessage]! - SEQUENCE_BAND_PAD) : msgY[p.fromMessage]! - SEQUENCE_BAND_PAD;
    const bottom = msgY[p.toMessage]! + (msgSelf[p.toMessage] ? SEQUENCE_SELF_BACK_DY : 0) + SEQUENCE_BAND_PAD;
    bandsEnd = Math.max(bandsEnd, bottom);
    raw.push({
      id: randomUUID(),
      kind: "boundary",
      x: 30,
      y: top,
      w: boardRight + 20 - 30,
      h: Math.max(40, bottom - top),
      color: "#2563eb",
      label: p.label.trim(),
    });
  });
  // Fixed 4-entry legend (benchmark parity), below content.
  const legendSpecs: Array<{ label: string; dash: string; color: string }> = [
    { label: "request", dash: "solid", color: "#374151" },
    { label: "return", dash: "dotted", color: "#374151" },
    { label: "async trace", dash: "dotted", color: "#8b5cf6" },
    { label: "default message", dash: "solid", color: "#8b5cf6" },
  ];
  const legendY = bandsEnd + 48;
  raw.push({
    id: randomUUID(),
    kind: "text",
    x: SEQUENCE_FIRST_COLUMN_X,
    y: legendY - 30,
    color: "#374151",
    fontSize: 12,
    text: "Legend",
  });
  legendSpecs.forEach((entry, i) => {
    const x = SEQUENCE_FIRST_COLUMN_X + i * 220;
    raw.push({
      id: randomUUID(),
      kind: "edge",
      x1: x,
      y1: legendY,
      x2: x + 60,
      y2: legendY,
      color: entry.color,
      width: 2,
      arrowhead: true,
      arrowStyle: "solid",
      dash: entry.dash,
      label: "",
    });
    raw.push({
      id: randomUUID(),
      kind: "text",
      x: x + 70,
      y: legendY - 8,
      color: "#374151",
      fontSize: 12,
      text: entry.label,
    });
  });
  const width = boardRight + 80;
  const height = legendY + 40;
  const elements = raw as WhiteboardElement[];
  if (elements.length > LIMITS.WHITEBOARD_ELEMENTS) {
    fail(`Layout exceeds element cap (${LIMITS.WHITEBOARD_ELEMENTS})`);
  }
  return { elements, width, height, legendY };
}
