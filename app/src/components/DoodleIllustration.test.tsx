import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DoodleIllustration, type DoodleVariant } from './DoodleIllustration';

const variants: DoodleVariant[] = [
  'empty',
  'offline',
  'not-found',
  'locked',
  'broken',
  'success',
  'receipt',
  'calendar',
  'bug',
  'checklist',
  'layers',
  'scales',
  'flag',
  'nodes',
  'layout',
  'idcard',
  'envelope',
  'bubble',
  'key',
  'chart',
  'canvas',
  'camera',
  'table',
  'clock',
  'box',
  'memory',
  'pending',
  'paid',
  'cancelled',
  'tour-team',
  'tour-project',
  'tour-plan',
  'tour-build',
  'tour-decide',
  'tour-collab',
  'tour-welcome',
  'tour-issues',
  'tour-tests',
  'tour-schema',
  'tour-releases',
  'tour-api',
  'tour-overview',
];

describe('DoodleIllustration', () => {
  it.each(variants)('renders object-scene %s without faces', (variant) => {
    const { container } = render(<DoodleIllustration variant={variant} />);
    expect(screen.getByLabelText(variant)).toBeDefined();
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    // No cartoon-face leftovers: eyes/blush must not exist in object scenes
    expect(svg?.innerHTML).not.toContain('#e8a0a0');
  });
  it('scales to the requested size', () => {
    const { container } = render(<DoodleIllustration variant="empty" size={140} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('140');
    expect(svg?.getAttribute('height')).toBe('140');
  });
});
