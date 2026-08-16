import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

HTMLCanvasElement.prototype.getContext = () => null;

afterEach(() => {
  cleanup();
});
