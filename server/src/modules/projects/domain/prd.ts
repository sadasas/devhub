import { z } from 'zod';

const prdSection = z.string().max(5_000);

export const prdSchema = z.object({
  purpose: prdSection.default(''),
  goals: prdSection.default(''),
  features: prdSection.default(''),
  scope: prdSection.default(''),
  outOfScope: prdSection.default(''),
});

export const prdPatchSchema = z.object({
  purpose: prdSection.optional(),
  goals: prdSection.optional(),
  features: prdSection.optional(),
  scope: prdSection.optional(),
  outOfScope: prdSection.optional(),
});

export type Prd = z.infer<typeof prdSchema>;
export type PrdPatch = z.infer<typeof prdPatchSchema>;

export const PRD_EMPTY: Prd = { purpose: '', goals: '', features: '', scope: '', outOfScope: '' };

export function mergePrd(patch: PrdPatch = {}, current: Prd = PRD_EMPTY): Prd {
  return {
    purpose: patch.purpose ?? current.purpose,
    goals: patch.goals ?? current.goals,
    features: patch.features ?? current.features,
    scope: patch.scope ?? current.scope,
    outOfScope: patch.outOfScope ?? current.outOfScope,
  };
}

export function normalizePrd(prd: unknown): Prd {
  const raw = (prd ?? {}) as Record<string, unknown>;
  return {
    purpose: typeof raw.purpose === 'string' ? raw.purpose : '',
    goals: typeof raw.goals === 'string' ? raw.goals : '',
    features: typeof raw.features === 'string' ? raw.features : '',
    scope: typeof raw.scope === 'string' ? raw.scope : '',
    outOfScope: typeof raw.outOfScope === 'string' ? raw.outOfScope : '',
  };
}
