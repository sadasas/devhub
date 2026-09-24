---
name: devhub-whiteboard
description: Work with DevHub whiteboards via MCP — validate layout, create/patch boards, author AI-SVG embeds. Use when asked to "draw on the whiteboard", "create a wireframe", "validate board layout", "add a flowchart", or when using any devhub whiteboard tool (create_whiteboard, update_whiteboard, patch_whiteboard, validate_whiteboard, list_whiteboards).
metadata:
  author: devhub
  version: "1.0.0"
  scope: whiteboard-only
---

# DevHub Whiteboard Skill

Operate DevHub whiteboard boards through MCP tools. Full tool contract:
repo `docs/03-engineering/mcp-integration.md`; embed contract:
repo `docs/03-engineering/whiteboard-embed-contract.md`.

## 0. Prerequisites

- MCP server connected with scope `mcp` (full) or `mcp:read` + `mcp:write`.
  Read-only work needs `mcp` or `mcp:read`; mutations need `mcp` or `mcp:write`.
- Every call needs a `projectId` (copy it from the project page header in the web app).

## 1. Mandatory workflow

```
list_whiteboards → validate_whiteboard (dry-run) → create_whiteboard / patch_whiteboard
```

1. `list_whiteboards({ projectId })` — see existing boards first; never create duplicates blindly.
2. `validate_whiteboard({ projectId, elements })` — dry-run, no DB write.
   Fix every `overlap` / `too_close` warning using its `suggestion` before writing.
3. Write with the right tool:
   - `create_whiteboard({ projectId, name, description?, elements? })` — new board.
     Omit element `id`s; the server assigns UUIDs.
   - `patch_whiteboard` — granular add/update/delete of individual elements.
   - `update_whiteboard` — **replaces the whole element array**. Only use it when
     you intend a full rewrite (e.g. you just read the board via `project_state`).

## 2. Element kinds cheat-sheet

| kind | Required geometry | Notes |
|---|---|---|
| `sticky` | `x, y, w, h` | `color`, `text` |
| `text` | `x, y` | `color`, `fontSize` (min 4) |
| `shape` | `x, y, w, h` | `shapeType`: `rect`/`diamond`/`ellipse`; `fill`: `solid`/`transparent`/`none`; `strokeWidth`, `label` |
| `edge` | `x1, y1, x2, y2` | `sourceNodeId`/`targetNodeId`, `sourcePort`/`targetPort` optional |
| `boundary` | `x, y, w, h` | Container; default label `fontSize` 16 |
| `ref` | `x, y` | Live card for a task/issue (`entity`, `entityId`); assume expanded 260×150 |
| `stroke` | `points[]` | Pen path; `width`, `color` |
| `embed` | `x, y, w, h` | AI SVG wireframe — see §3 |

## 3. `embed` (AI SVG wireframes)

```json
{ "kind": "embed", "x": 0, "y": 0, "w": 360, "h": 520,
  "title": "Login form", "svg": "<g data-component=\"submit\"><rect .../></g>" }
```

- Send a **fragment** (no outer `<svg>`; a single outer tag is unwrapped automatically).
- `w/h`: 20–2000. SVG content uses **local** coords `0..w` / `0..h`. `title` is required
  (shown in Layers panel, fallback, export).
- **Grouping (required for multi-widget wireframes):** wrap each widget in
  `<g data-component="name">`, e.g. `<g data-component="submit">...</g>`.
  Ungrouped embeds trigger advisory `grouping` warnings and cannot be split/edited per component.
- **Sanitizer allowlist:** `g rect circle ellipse line polyline polygon path text tspan
  defs linearGradient radialGradient stop clipPath` (+ nested `svg`).
  Always stripped: `script style foreignObject image use a animate*`, `on*` handlers,
  `href`, inline `style`, `javascript:` URLs. Hard-fail (nothing saved) if no
  renderable content remains — the tool response names the element and reason.
- `id` attributes are namespaced per element on write — reuse ids freely across embeds.

## 4. Limits (hard)

- Max **1000** elements per board, **50** boards per project, **20** embeds per board.
- Keep ≥30px gaps between nodes (≥35px around `ref` cards); sticky-inside-boundary
  is containment, not overlap. Coordinates must be finite within ±100000.
- `embed` is exempt from overlap/too-close showcase checks; `validate_whiteboard`
  only checks finite-coords/out-of-bounds for it.

## 5. Common pitfalls

- `update_whiteboard` with a partial `elements` array **deletes everything else**. Prefer `patch_whiteboard`.
- `fill: false` is legacy boolean — new boards use `"none"` (or `"solid"`/`"transparent"`).
- `ref` cards render expanded (260×150) even though stored collapsed — validate against the expanded size.
- Check the response `groupingHints` after create/patch and group flagged embeds.
- Scope errors (`Insufficient OAuth scope`): re-auth with `mcp` scope.

## 6. Quick example

```
1. list_whiteboards({ projectId: "<uuid>" })
2. validate_whiteboard({ projectId: "<uuid>", elements: [
     { kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" },
     { kind: "embed", x: 240, y: 0, w: 360, h: 520, title: "Login form",
       svg: "<g data-component=\"submit\"><rect x=\"0\" y=\"0\" width=\"360\" height=\"52\"/></g>" }
   ] })
3. create_whiteboard({ projectId: "<uuid>", name: "Auth flow", elements: [ ...validated... ] })
```
