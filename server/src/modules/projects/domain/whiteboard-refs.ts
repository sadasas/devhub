import type { State, WhiteboardElement } from "./state.js";

export interface DanglingRefWarning {
  code: "dangling_ref" | "dangling_edge";
  elementId: string;
  message: string;
  suggestion: string;
}

/** ref.entity values map 1:1 to State collection keys (mirror state.ts). */
const REF_ENTITY_TO_COLLECTION = {
  tasks: "tasks",
  issues: "issues",
  testCases: "testCases",
  milestones: "milestones",
  techEntries: "techEntries",
  decisions: "decisions",
  tables: "tables",
  apiCollections: "apiCollections",
  apiEndpoints: "apiEndpoints",
} as const;

/**
 * Advisory existence checks for references an agent sends.
 * Pure domain: no express/pg. Never throws for missing targets —
 * callers surface these as `warnings` (board is still saved).
 *
 * - `ref` elements: `entityId` must exist in the matching state collection.
 *   Pass `state: null` to skip ref checks (e.g. project failed to load);
 *   edge-endpoint checks still run (they only need the element array).
 * - `edge` elements: `sourceNodeId`/`targetNodeId` must exist among the
 *   same element array (the full board for create/replace, the merged
 *   board for patch).
 */
export function findDanglingRefs(
  state: State | null,
  elements: WhiteboardElement[],
): DanglingRefWarning[] {
  const warnings: DanglingRefWarning[] = [];
  const ids = new Set(elements.map((el) => el.id));
  const knownByCollection = new Map<string, Set<string>>();
  const knownIds = (collection: string): Set<string> => {
    let set = knownByCollection.get(collection);
    if (!set) {
      const items = (state?.[collection as keyof State] ?? []) as Array<{ id: string }>;
      set = new Set(items.map((e) => e.id));
      knownByCollection.set(collection, set);
    }
    return set;
  };
  for (const el of elements) {
    if (el.kind === "ref") {
      if (state === null) continue;
      const collection = REF_ENTITY_TO_COLLECTION[el.entity];
      if (collection && !knownIds(collection).has(el.entityId)) {
        warnings.push({
          code: "dangling_ref",
          elementId: el.id,
          message: `ref ${el.id.slice(0, 8)} points to missing ${el.entity} ${el.entityId}`,
          suggestion: `Create the ${el.entity} first (or fix entityId); the card renders empty until the target exists.`,
        });
      }
    } else if (el.kind === "edge") {
      const endpoints = [
        ["sourceNodeId", el.sourceNodeId],
        ["targetNodeId", el.targetNodeId],
      ] as const;
      for (const [key, target] of endpoints) {
        if (target && !ids.has(target)) {
          warnings.push({
            code: "dangling_edge",
            elementId: el.id,
            message: `edge ${el.id.slice(0, 8)} ${key} points to unknown element ${target}`,
            suggestion: `Fix ${key} to an existing element id, or omit it for a free-floating edge.`,
          });
        }
      }
    }
  }
  return warnings;
}
