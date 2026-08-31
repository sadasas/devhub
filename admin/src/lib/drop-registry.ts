const handlers = new Map<string, (taskId: string) => void>();

export function registerDrop(key: string, handler: (taskId: string) => void): () => void {
  handlers.set(key, handler);
  return () => {
    if (handlers.get(key) === handler) handlers.delete(key);
  };
}

export function getDropHandler(key: string | null | undefined): ((taskId: string) => void) | undefined {
  return key ? handlers.get(key) : undefined;
}