import type { ActiveItem, ActiveItemType, ActiveItemStatus, TrackerState, TrackerListener } from "./types"

export class ActiveItemTracker {
  private state: TrackerState = {
    items: [],
    sessionId: null,
  }
  private listeners: Set<TrackerListener> = new Set()
  private cleanupFns: Array<() => void> = []

  subscribe(listener: TrackerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState(): TrackerState {
    return this.state
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state, items: [...this.state.items] })
    }
  }

  private addItem(item: ActiveItem) {
    this.state.items.push(item)
    this.notify()
  }

  private updateItem(id: string, updates: Partial<ActiveItem>) {
    const item = this.state.items.find((i) => i.id === id)
    if (item) {
      Object.assign(item, updates)
      this.notify()
    }
  }

  private findRunningByType(type: ActiveItemType, name: string): ActiveItem | undefined {
    return this.state.items.find(
      (i) => i.type === type && i.name === name && i.status !== "completed" && i.status !== "failed"
    )
  }

  trackToolCalled(callID: string, toolName: string, input: Record<string, unknown>, sessionId: string) {
    this.state.sessionId = sessionId

    const isSkill = toolName === "skill"
    const type: ActiveItemType = isSkill ? "skill" : "tool"
    const skillName = isSkill ? (input?.name as string) || "unknown" : toolName

    const existing = this.findRunningByType(type, skillName)
    if (existing) {
      this.updateItem(existing.id, { status: "running" })
      return
    }

    this.addItem({
      id: callID,
      name: skillName,
      type,
      status: "running",
      startedAt: Date.now(),
    })
  }

  trackToolSuccess(callID: string) {
    const item = this.state.items.find((i) => i.id === callID)
    if (item) {
      this.updateItem(callID, {
        status: "completed",
        endedAt: Date.now(),
      })
      setTimeout(() => this.cleanupCompleted(), 3000)
    }
  }

  trackToolFailed(callID: string, error?: string) {
    const item = this.state.items.find((i) => i.id === callID)
    if (item) {
      this.updateItem(callID, {
        status: "failed",
        endedAt: Date.now(),
        error,
      })
      setTimeout(() => this.cleanupCompleted(), 3000)
    }
  }

  trackAgentStarted(agentName: string, sessionId: string) {
    this.state.sessionId = sessionId

    const existing = this.findRunningByType("agent", agentName)
    if (existing) {
      this.updateItem(existing.id, { status: "running" })
      return
    }

    this.addItem({
      id: `agent-${agentName}-${Date.now()}`,
      name: agentName,
      type: "agent",
      status: "running",
      startedAt: Date.now(),
    })
  }

  trackAgentCompleted(agentName: string) {
    const item = this.state.items.find(
      (i) => i.type === "agent" && i.name === agentName && i.status === "running"
    )
    if (item) {
      this.updateItem(item.id, {
        status: "completed",
        endedAt: Date.now(),
      })
      setTimeout(() => this.cleanupCompleted(), 3000)
    }
  }

  private cleanupCompleted() {
    const now = Date.now()
    const maxAge = 5000
    this.state.items = this.state.items.filter((i) => {
      if (i.status === "completed" || i.status === "failed") {
        return i.endedAt && now - i.endedAt < maxAge
      }
      return true
    })
    this.notify()
  }

  bindEvents(eventBus: { on: (type: string, handler: (event: any) => void) => () => void }) {
    const unsubs = [
      eventBus.on("session.next.tool.called", (event: any) => {
        const { callID, tool, input, sessionID } = event.properties
        this.trackToolCalled(callID, tool, input, sessionID)
      }),
      eventBus.on("session.next.tool.success", (event: any) => {
        this.trackToolSuccess(event.properties.callID)
      }),
      eventBus.on("session.next.tool.failed", (event: any) => {
        this.trackToolFailed(event.properties.callID, event.properties.error?.message)
      }),
      eventBus.on("session.next.step.started", (event: any) => {
        this.trackAgentStarted(event.properties.agent, event.properties.sessionID)
      }),
      eventBus.on("session.next.step.ended", (event: any) => {
        const item = this.state.items.find(
          (i) => i.type === "agent" && i.status === "running"
        )
        if (item) {
          this.trackAgentCompleted(item.name)
        }
      }),
      eventBus.on("session.next.agent.switched", (event: any) => {
        this.trackAgentStarted(event.properties.agent, event.properties.sessionID)
      }),
    ]

    this.cleanupFns.push(...unsubs)
    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }

  dispose() {
    for (const fn of this.cleanupFns) {
      fn()
    }
    this.cleanupFns = []
    this.listeners.clear()
  }
}
