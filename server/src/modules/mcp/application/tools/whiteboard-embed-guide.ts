/**
 * Panduan ringkas kind `embed` untuk deskripsi MCP.
 * Satu sumber agar create/update/validate/patch tidak drift.
 * Kontrak penuh: docs/03-engineering/whiteboard-embed-contract.md.
 */
export const EMBED_EXAMPLE_GROUPED =
  '{ kind: "embed", x: 0, y: 0, w: 360, h: 520, title: "Login form", svg: "<g data-component=\\"card\\"><rect .../></g><g data-component=\\"submit\\"><rect .../><text>Login</text></g>" }';

export const EMBED_GUIDE =
  'Kind "embed" is an AI SVG wireframe fragment (no outer <svg>; one outer tag is auto-unwrapped). ' +
  'w/h 20..2000; SVG uses local coords 0..w / 0..h; title is required and meaningful (Layers panel + fallback + export). ' +
  'Grouping required for multi-widget wireframes: wrap each widget in <g data-component="name">, e.g. <g data-component="submit"><rect .../><text>Login</text></g>. ' +
  'Ungrouped embeds save but trigger groupingHints and cannot be split per component. ' +
  'Allowlist tags only: g rect circle ellipse line polyline polygon path text tspan defs linearGradient radialGradient stop clipPath (+ nested svg). ' +
  'Always stripped: script style foreignObject image use a animate* set iframe embed object video audio, on* handlers, href/xlink:href, inline style, javascript: values, non-local url() (only url(#local) survives); comments/DOCTYPE dropped. ' +
  'Hard-fail (nothing saved) if no renderable content remains. Max 20 embeds per board; id attrs are namespaced per element so reuse ids freely. ' +
  'Embeds are exempt from overlap/too-close showcase checks; only finite coords within ±100000 apply. ' +
  'Workflow: list_whiteboards → validate_whiteboard (dry-run) → create_whiteboard / patch_whiteboard; responses may carry groupingHints, sanitizerStripped, warnings.';
