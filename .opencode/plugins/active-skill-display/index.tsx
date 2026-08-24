/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { ActiveItemTracker } from "./tracker"
import { renderActiveContext } from "./sidebar"

const tui: TuiPlugin = async (api) => {
  const tracker = new ActiveItemTracker()
  const unsubEvents = tracker.bindEvents(api.event)

  const [state, setState] = createSignal(tracker.getState())
  const unsubTracker = tracker.subscribe(setState)

  api.slots.register({
    id: "active-skill-display",
    slots: {
      session_prompt: (props) => {
        if (!props.session_id) return props.children

        const currentState = state()
        if (currentState.items.length === 0) return props.children

        return (
          <box flexDirection="column" flexShrink={0}>
            <box
              paddingLeft={2}
              paddingRight={1}
              paddingTop={0}
              paddingBottom={0}
              flexShrink={0}
            >
              <text>{renderActiveContext(currentState, api.theme.current)}</text>
            </box>
            {props.children}
          </box>
        )
      },
    },
  })

  api.lifecycle.onDispose(async () => {
    unsubEvents()
    unsubTracker()
    tracker.dispose()
  })
}

export default { id: "active-skill-display", tui } satisfies TuiPluginModule
