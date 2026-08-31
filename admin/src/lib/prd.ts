import { Flag, MagnifyingGlass, Prohibit, Rocket, Target, type Icon } from '@phosphor-icons/react';
import type { ProjectPrd } from './types';

export const PRD_SECTIONS: { key: keyof ProjectPrd; label: string; helper: string; icon: Icon }[] = [
  {
    key: 'purpose',
    label: 'Purpose',
    helper: 'Why this project exists — the problem it solves.',
    icon: Target,
  },
  {
    key: 'goals',
    label: 'Goals',
    helper: 'What success looks like. One line per goal.',
    icon: Flag,
  },
  {
    key: 'features',
    label: 'Features',
    helper: 'What this project will do. One feature per line.',
    icon: Rocket,
  },
  {
    key: 'scope',
    label: 'Scope',
    helper: 'What is in scope for this project.',
    icon: MagnifyingGlass,
  },
  {
    key: 'outOfScope',
    label: 'Out of scope',
    helper: 'What is explicitly out of scope — for now or forever.',
    icon: Prohibit,
  },
];

export const EMPTY_PRD: ProjectPrd = { purpose: '', goals: '', features: '', scope: '', outOfScope: '' };