import type { ActiveItem, TrackerState } from "./types"
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"

function getStatusIcon(status: ActiveItem["status"]): string {
  switch (status) {
    case "completed":
      return "✓"
    case "failed":
      return "✗"
    case "running":
      return "●"
    default:
      return "○"
  }
}

function getTypeIcon(type: ActiveItem["type"]): string {
  switch (type) {
    case "skill":
      return "⚡"
    case "agent":
      return "🤖"
    case "tool":
      return "🔧"
    default:
      return "•"
  }
}

function formatDuration(startedAt: number, endedAt?: number): string {
  const duration = (endedAt || Date.now()) - startedAt
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
  return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`
}

export function renderActiveContext(
  state: TrackerState,
  _theme: TuiThemeCurrent
): string {
  const active = state.items.filter((i) => i.status === "running" || i.status === "loading")
  const recent = state.items.filter((i) => i.status === "completed" || i.status === "failed")

  const parts: string[] = []

  for (const item of active.slice(0, 3)) {
    const icon = getTypeIcon(item.type)
    const statusIcon = getStatusIcon(item.status)
    const duration = formatDuration(item.startedAt)
    parts.push(`${icon} ${item.name} ${statusIcon} ${duration}`)
  }

  for (const item of recent.slice(0, 2)) {
    const icon = getTypeIcon(item.type)
    const statusIcon = getStatusIcon(item.status)
    const duration = formatDuration(item.startedAt, item.endedAt)
    parts.push(`${icon} ${item.name} ${statusIcon} ${duration}`)
  }

  if (parts.length === 0) return ""

  return parts.join(" │ ")
}
