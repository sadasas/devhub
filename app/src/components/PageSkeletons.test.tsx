import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectSettingsSkeleton } from './PageSkeletons';

describe('ProjectSettingsSkeleton', () => {
  it('mirrors the settings shell (nav + panel blocks)', () => {
    render(<ProjectSettingsSkeleton />);
    const root = screen.getByRole('status', { name: 'Loading project settings' });
    expect(root.querySelector('.settings-nav')).not.toBeNull();
    expect(root.querySelector('.project-settings-panel .profile-panel')).not.toBeNull();
  });
});
