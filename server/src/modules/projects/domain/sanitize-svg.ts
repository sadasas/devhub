import { LIMITS, type State } from "./state.js";

/**
 * Sanitizer SVG untuk kind bebas `embed` (wireframe AI).
 * Domain murni: tanpa express/pg/DOM — tokenizer string + allowlist,
 * tanpa dep baru (Node tidak punya DOMParser).
 *
 * Kebijakan:
 * - Tag presentasi/geometri + teks diizinkan; struktur aktif dibuang.
 * - `<script>`, `<style>`, `<foreignObject>`, `<image>`, `<use>`, `<a>`,
 *   animasi (`animate*`, `set`), media (`iframe/embed/object/video/audio`)
 *   DIBUANG. Untuk script/style isinya ikut dibuang; untuk tag lain
 *   isi (children) dipertahankan agar wireframe tidak hilang total.
 * - Atribut event (`on*`), `style` inline, `href`/`xlink:href` DIBUANG.
 * - Nilai `url(...)` hanya boleh referensi lokal `url(#id)` (clip/fill).
 * - Nilai mengandung `javascript:` (case-insensitive) DIBUANG.
 * - `data-*` DIIZINKAN (kontrak grouping: `<g data-component="...">`).
 * - Komentar, DOCTYPE, processing-instruction DIBUANG.
 * - Outer `<svg>` tunggal di-unwrap (renderer menyediakan viewport sendiri).
 * - Hasil tanpa konten renderable = hard-fail (bukan disimpan kosong).
 */

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
]);

/**
 * SVG case-sensitive (clipPath bukan clippath); penyerang bisa memakai
 * varian kapital (SCRIPT, ForeignObject). Perbandingan selalu lowercase,
 * yang di-emit selalu bentuk kanonis allowlist.
 */
const TAG_CANONICAL = new Map([...ALLOWED_TAGS].map((t) => [t.toLowerCase(), t]));
const DROP_CONTENT_TAGS = new Set(["script", "style"]);

/** Atribut presentasi/geometri/teks yang diizinkan (selain data-*). */
const ALLOWED_ATTRS = new Set([
  "id",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "points",
  "d",
  "dx",
  "dy",
  "rotate",
  "textLength",
  "lengthAdjust",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "word-spacing",
  "line-height",
  "transform",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "clip-path",
  "clip-rule",
  "viewBox",
  "preserveAspectRatio",
]);

const ATTR_CANONICAL = new Map([...ALLOWED_ATTRS].map((a) => [a.toLowerCase(), a]));

/** Tag yang bisa di-render (ada tidaknya menentukan hard-fail). */
const RENDERABLE_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g;
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const LOCAL_URL_RE = /^url\(#[^)\s]+\)$/;
const JS_PROTO_RE = /javascript\s*:/i;

export interface SanitizeResult {
  /** Markup bersih, siap disimpan di `embed.svg` / dirender. */
  svg: string;
  /** Nama tag/atribut yang dibuang (untuk pesan perbaikan ke agen). */
  removed: string[];
}

function pushRemoved(removed: string[], name: string): void {
  if (!removed.includes(name)) removed.push(name);
}

function cleanAttrValue(name: string, value: string): string | null {
  if (JS_PROTO_RE.test(value)) return null;
  if (name === "clip-path" || name === "fill" || name === "stroke") {
    if (value.includes("url(") && !LOCAL_URL_RE.test(value.trim())) return null;
  }
  return value;
}

/**
 * Sanitasi satu dokumen/fragment SVG. Tidak pernah melempar untuk input
 * string — hard-fail dikembalikan sebagai `{ ok: false }` agar pemanggil
 * (MCP tool / REST) bisa merumuskan pesannya sendiri.
 */
export function sanitizeSvgEmbed(
  input: string,
): { ok: true; result: SanitizeResult } | { ok: false; reason: string } {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, reason: "SVG is empty" };
  }
  // Buang komentar, DOCTYPE, processing-instruction di muka.
  let src = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^<>]*>/gi, "")
    .replace(/<\?[\s\S]*?\?>/g, "");
  // Unwrap outer <svg> tunggal (renderer menyediakan viewport + clip sendiri).
  const outer = src.match(/^\s*<svg\b[^<>]*>([\s\S]*)<\/svg>\s*$/i);
  if (outer) src = outer[1] ?? "";

  const removed: string[] = [];
  const out: string[] = [];
  let lastIndex = 0;
  // Kedalaman skip untuk DROP_CONTENT_TAGS (script/style + isinya).
  let skipDepth = 0;
  let renderable = 0;

  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(src)) !== null) {
    const [full, closing, rawName] = m;
    const lower = (rawName ?? "").toLowerCase();
    const canon = TAG_CANONICAL.get(lower);
    const isClose = closing === "/";
    const isSelfClose = /\/\s*$/.test(m[3] ?? "");

    if (skipDepth > 0) {
      if (!isClose && !isSelfClose && DROP_CONTENT_TAGS.has(lower)) skipDepth += 1;
      if (isClose && DROP_CONTENT_TAGS.has(lower)) skipDepth = Math.max(0, skipDepth - 1);
      lastIndex = (m.index ?? 0) + full.length;
      continue;
    }

    if (!isClose && DROP_CONTENT_TAGS.has(lower) && !isSelfClose) {
      pushRemoved(removed, lower);
      skipDepth = 1;
      lastIndex = (m.index ?? 0) + full.length;
      continue;
    }

    if (!canon) {
      pushRemoved(removed, lower);
      // Tag tak dikenal dibuang, children dipertahankan (kecuali self-close).
      lastIndex = (m.index ?? 0) + full.length;
      continue;
    }

    if (isClose) {
      out.push(src.slice(lastIndex, m.index ?? 0), `</${canon}>`);
      lastIndex = (m.index ?? 0) + full.length;
      continue;
    }

    // Tag buka / self-close yang diizinkan: saring atribut.
    const rawAttrs = m[3] ?? "";
    const kept: string[] = [];
    ATTR_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = ATTR_RE.exec(rawAttrs)) !== null) {
      const rawAttr = am[1] ?? "";
      const attrLower = rawAttr.toLowerCase();
      // Pecah namespace (xlink:href -> href) agar tidak lolos.
      const base = attrLower.includes(":") ? (attrLower.split(":").pop() ?? "") : attrLower;
      const value = am[2] ?? am[3] ?? am[4] ?? "";
      if (base.startsWith("on") || base === "href" || base === "style") {
        pushRemoved(removed, base.startsWith("on") ? "event-handler" : base);
        continue;
      }
      if (base.startsWith("data-")) {
        kept.push(`${rawAttr}="${value.replace(/"/g, "&quot;")}"`);
        continue;
      }
      const attrCanon = ATTR_CANONICAL.get(base);
      if (!attrCanon) {
        pushRemoved(removed, base);
        continue;
      }
      const clean = cleanAttrValue(attrCanon, value);
      if (clean === null) {
        pushRemoved(removed, `${attrCanon}:unsafe-value`);
        continue;
      }
      kept.push(value === "" ? `${attrCanon}` : `${attrCanon}="${clean.replace(/"/g, "&quot;")}"`);
    }
    if (RENDERABLE_TAGS.has(canon)) renderable += 1;
    out.push(
      src.slice(lastIndex, m.index ?? 0),
      `<${canon}${kept.length > 0 ? ` ${kept.join(" ")}` : ""}${isSelfClose ? "/" : ""}>`,
    );
    lastIndex = (m.index ?? 0) + full.length;
  }
  out.push(src.slice(lastIndex));

  const svg = out.join("").trim();
  if (renderable === 0) {
    return { ok: false, reason: "No renderable SVG content left after sanitizing" };
  }
  return { ok: true, result: { svg, removed } };
}

export class EmbedSanitizerError extends Error {
  readonly elementId: string;
  readonly removed: string[];
  constructor(elementId: string, reason: string, removed: string[] = []) {
    super(`Embed ${elementId}: ${reason}`);
    this.name = "EmbedSanitizerError";
    this.elementId = elementId;
    this.removed = removed;
  }
}

/**
 * Satu-satunya pintu tulis embed: sanitasi in-place seluruh `embed.svg`
 * dalam state + tegakkan cap jumlah embed per board.
 * Dipakai saveState MCP, mutateProject REST, PUT /state, dan import/restore.
 * Melempar EmbedSanitizerError (pemanggil merumuskan ke McpError/ApiError).
 */
export function sanitizeStateEmbeds(state: State): { cleaned: number; stripped: string[] } {
  let cleaned = 0;
  const stripped: string[] = [];
  for (const board of state.whiteboards) {
    let embedCount = 0;
    for (const el of board.elements) {
      if (el.kind !== "embed") continue;
      embedCount += 1;
      if (embedCount > LIMITS.WHITEBOARD_EMBEDS_PER_BOARD) {
        throw new EmbedSanitizerError(
          el.id,
          `Embed cap exceeded (${LIMITS.WHITEBOARD_EMBEDS_PER_BOARD} per board) — split the wireframe into multiple boards or convert parts to native elements`,
        );
      }
      const res = sanitizeSvgEmbed(el.svg);
      if (!res.ok) throw new EmbedSanitizerError(el.id, res.reason);
      if (res.result.svg !== el.svg) {
        el.svg = res.result.svg;
        cleaned += 1;
      }
      for (const r of res.result.removed) {
        if (!stripped.includes(r)) stripped.push(r);
      }
    }
  }
  return { cleaned, stripped };
}
