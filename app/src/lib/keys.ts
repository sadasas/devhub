const TYPING_TARGET = /^(INPUT|TEXTAREA)$/;

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (TYPING_TARGET.test(target.tagName) || target.isContentEditable)
  );
}

export function isModalOrPaletteOpen(): boolean {
  return Boolean(document.querySelector('.modal-backdrop, .palette'));
}