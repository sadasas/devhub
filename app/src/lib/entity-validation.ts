/**
 * Required-field validation for autosave.
 * Mirror backend `min(1)` (server/.../domain/state.ts): title/name wajib non-kosong.
 * Dipakai project-context (tahan mutation) + edit modal (InlineError + tahan indikator save).
 */

export function isNonEmptyTitle(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isTaskValid(task: { title: string }): boolean {
  return isNonEmptyTitle(task.title);
}

export function isIssueValid(issue: { title: string }): boolean {
  return isNonEmptyTitle(issue.title);
}

export function isDecisionValid(decision: { title: string }): boolean {
  return isNonEmptyTitle(decision.title);
}

export function isTestCaseValid(testCase: { name: string }): boolean {
  return isNonEmptyTitle(testCase.name);
}

export function isTechValid(entry: { name: string }): boolean {
  return isNonEmptyTitle(entry.name);
}

export function isMilestoneValid(milestone: { name: string }): boolean {
  return isNonEmptyTitle(milestone.name);
}

/** Mirror columnSchema: setiap kolom wajib name + type non-kosong. */
export function isColumnValid(column: { name: string; type: string }): boolean {
  return isNonEmptyTitle(column?.name) && isNonEmptyTitle(column?.type);
}

/** Mirror tableSchema: nama tabel + semua kolom valid. */
export function isTableValid(table: { name: string; columns: { name: string; type: string }[] }): boolean {
  if (!isNonEmptyTitle(table?.name)) return false;
  if (!Array.isArray(table?.columns)) return false;
  return table.columns.every((c) => c != null && isColumnValid(c));
}

/** Mirror relationSchema: 4 ujung wajib terisi (format uuid divalidasi server). */
export function isRelationValid(relation: {
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
}): boolean {
  if (relation == null) return false;
  return (
    isNonEmptyTitle(relation.fromTableId) &&
    isNonEmptyTitle(relation.fromColumnId) &&
    isNonEmptyTitle(relation.toTableId) &&
    isNonEmptyTitle(relation.toColumnId)
  );
}

/** Mirror apiCollectionSchema: name wajib. */
export function isApiCollectionValid(collection: { name: string }): boolean {
  return isNonEmptyTitle(collection?.name);
}

/** Mirror apiEndpointSchema: name + path wajib (headers/params/body opsional). */
export function isApiEndpointValid(endpoint: { name: string; path: string }): boolean {
  return isNonEmptyTitle(endpoint?.name) && isNonEmptyTitle(endpoint?.path);
}

/** Mirror schemaVersionSchema: version wajib. */
export function isSchemaVersionValid(version: { version: string }): boolean {
  return isNonEmptyTitle(version?.version);
}

/**
 * Mirror whiteboardSchema: name saja (ada default server).
 * Elemen (stroke points dsb.) sengaja longgar agar autosave menggambar tidak tersendat.
 */
export function isWhiteboardValid(whiteboard: { name: string }): boolean {
  return isNonEmptyTitle(whiteboard?.name);
}

/** Mirror erdGroupSchema: name wajib (tableIds/color opsional). */
export function isErdGroupValid(group: { name: string }): boolean {
  return isNonEmptyTitle(group?.name);
}
