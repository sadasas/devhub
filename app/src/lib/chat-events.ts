const CHAT_TOGGLE_EVENT = 'devhub:toggle-chat';

export function toggleChat() {
  window.dispatchEvent(new CustomEvent(CHAT_TOGGLE_EVENT));
}

export function onToggleChat(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(CHAT_TOGGLE_EVENT, handler);
  return () => window.removeEventListener(CHAT_TOGGLE_EVENT, handler);
}

export const CHAT_OPEN_EVENT = 'devhub:open-chat';

export function openChat() {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT));
}

export function onOpenChat(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(CHAT_OPEN_EVENT, handler);
  return () => window.removeEventListener(CHAT_OPEN_EVENT, handler);
}
