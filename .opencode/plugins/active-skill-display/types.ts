export type ActiveItemType = 'skill' | 'agent' | 'tool'

export type ActiveItemStatus = 'loading' | 'running' | 'completed' | 'failed'

export type ActiveItem = {
  id: string
  name: string
  type: ActiveItemType
  status: ActiveItemStatus
  startedAt: number
  endedAt?: number
  description?: string
  error?: string
}

export type TrackerState = {
  items: ActiveItem[]
  sessionId: string | null
}

export type TrackerListener = (state: TrackerState) => void
