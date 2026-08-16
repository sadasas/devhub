export interface ChatTokenRef {
  entity: string;
  entityId: string;
}

export function buildMentionToken(title: string, entity: string, entityId: string): string {
  return `@[${title}](${entity}:${entityId})`;
}

const TOKEN_RE = /@\[([^\]]+)\]\(([^:]+):([^)]+)\)/g;

export function parseChatRefs(content: string): ChatTokenRef[] {
  const refs: ChatTokenRef[] = [];
  for (const match of content.matchAll(TOKEN_RE)) {
    refs.push({ entity: match[2] ?? '', entityId: match[3] ?? '' });
  }
  return refs;
}