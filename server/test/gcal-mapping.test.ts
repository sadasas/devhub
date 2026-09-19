import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { taskToEvent } from "../src/modules/integrations/gcal/application/mapping.js";

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    projectId: randomUUID(),
    title: "Ship calendar sync",
    status: "inProgress" as const,
    priority: "high" as const,
    labels: ["backend", "gcal"],
    description: "Sync tasks to Google Calendar",
    startDate: "2026-09-20",
    dueDate: "2026-09-22",
    ...overrides,
  };
}

describe("gcal mapping taskToEvent (5 kasus)", () => {
  it("1) normal: start=due span 2 hari + deep-link + extendedProperties", () => {
    const task = baseTask();
    const ev = taskToEvent(task, { baseUrl: "https://app.test" });
    expect(ev).not.toBeNull();
    expect(ev!.summary).toBe("Ship calendar sync");
    expect(ev!.start).toEqual({ date: "2026-09-20" });
    expect(ev!.end).toEqual({ date: "2026-09-22" });
    expect(ev!.description).toContain("https://app.test/project/");
    expect(ev!.description).toContain("Priority: high");
    expect(ev!.description).toContain("backend, gcal");
    expect(ev!.extendedProperties.private).toEqual({
      devhubTaskId: task.id,
      projectId: task.projectId,
    });
  });

  it("2) status done: prefix [Done]", () => {
    const ev = taskToEvent(baseTask({ status: "done", title: "Release M1" }));
    expect(ev!.summary).toBe("[Done] Release M1");
  });

  it("3) hanya dueDate: single-day span min 1 hari (end = start+1)", () => {
    const task = baseTask({ startDate: null, dueDate: "2026-09-25" });
    const ev = taskToEvent(task);
    expect(ev!.start).toEqual({ date: "2026-09-25" });
    expect(ev!.end).toEqual({ date: "2026-09-26" });
  });

  it("4) hanya startDate: end = start+1 + tanggal sama dipaksa 1 hari", () => {
    const onlyStart = taskToEvent(baseTask({ startDate: "2026-09-10", dueDate: null }));
    expect(onlyStart!.start).toEqual({ date: "2026-09-10" });
    expect(onlyStart!.end).toEqual({ date: "2026-09-11" });

    const sameDay = taskToEvent(baseTask({ startDate: "2026-09-10", dueDate: "2026-09-10" }));
    expect(sameDay!.start).toEqual({ date: "2026-09-10" });
    expect(sameDay!.end).toEqual({ date: "2026-09-11" });
  });

  it("5) tanpa tanggal: skip null", () => {
    expect(taskToEvent(baseTask({ startDate: null, dueDate: null }))).toBeNull();
    expect(taskToEvent(baseTask({ startDate: undefined, dueDate: undefined }))).toBeNull();
  });
});
