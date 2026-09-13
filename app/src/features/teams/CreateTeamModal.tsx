import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useTeams } from '../../state/teams-context';
import { isTourActive } from '../onboarding/tour-events';
import {
  TEAM_SLUG_MAX_LENGTH,
  isReservedTeamSlug,
  isValidTeamSlugFormat,
  normalizeTeamSlug,
  slugifyTeamName,
} from '../../lib/team-slug';
import { Plus } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { FE_LIMITS } from '../../lib/limits';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
}

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'auto-fallback' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken'; suggestion: string | null }
  | { kind: 'reserved' }
  | { kind: 'invalid' };

// Live-preview slug field: auto-fills from the team name until the user edits
// it manually (slugTouched), then stays manual. Availability is checked with a
// 400ms debounce plus a final server check on submit; empty names fall back to
// the server-generated team-xxxx pattern (placeholder preview, no pre-check).
export function CreateTeamModal({ open, onClose }: CreateTeamModalProps) {
  const { t } = useTranslation('account');
  const { createTeam } = useTeams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checkSeq = useRef(0);

  // Reset drafts whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setName('');
    setIcon('');
    setSlugInput('');
    setSlugTouched(false);
    setSlugStatus({ kind: 'idle' });
    setError(null);
    setSubmitting(false);
  }, [open ]);

  const autoBase = slugifyTeamName(name);
  const autoValid =
    autoBase.length > 0 && isValidTeamSlugFormat(autoBase) && !isReservedTeamSlug(autoBase);
  // Effective slug for preview + checks: manual when touched, else auto base.
  const effectiveRaw = slugTouched ? normalizeTeamSlug(slugInput) : autoBase;
  const previewSlug = slugTouched
    ? normalizeTeamSlug(slugInput) || (autoValid ? autoBase : 'team-xxxx')
    : autoValid
      ? autoBase
      : 'team-xxxx';

  // Debounced availability check (400ms) for real slug candidates only.
  useEffect(() => {
    if (!open) return;
    if (!effectiveRaw) {
      setSlugStatus(slugTouched ? { kind: 'idle' } : { kind: 'auto-fallback' });
      return;
    }
    if (!isValidTeamSlugFormat(effectiveRaw)) {
      setSlugStatus({ kind: 'invalid' });
      return;
    }
    if (isReservedTeamSlug(effectiveRaw)) {
      setSlugStatus({ kind: 'reserved' });
      return;
    }
    setSlugStatus({ kind: 'checking' });
    const seq = (checkSeq.current += 1);
    const timer = setTimeout(() => {
      void api
        .checkTeamSlug(effectiveRaw)
        .then((res) => {
          if (checkSeq.current !== seq) return;
          if (res.available) setSlugStatus({ kind: 'available' });
          else if (res.reason === 'reserved') setSlugStatus({ kind: 'reserved' });
          else if (res.reason === 'invalid') setSlugStatus({ kind: 'invalid' });
          else setSlugStatus({ kind: 'taken', suggestion: res.suggestion });
        })
        .catch(() => {
          // Network hiccup: leave the last status, final check on submit decides.
          if (checkSeq.current === seq) setSlugStatus({ kind: 'idle' });
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [effectiveRaw, open, slugTouched ]);

  const slugBlocked =
    slugStatus.kind === 'taken' || slugStatus.kind === 'reserved' || slugStatus.kind === 'invalid';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) return;
    // Final server-side availability check for manual slugs (closes the race).
    let submitSlug: string | undefined;
    if (slugTouched && slugInput.trim()) {
      const finalSlug = normalizeTeamSlug(slugInput);
      if (!isValidTeamSlugFormat(finalSlug)) {
        setError(t('teams.createModal.slugInvalid'));
        return;
      }
      if (isReservedTeamSlug(finalSlug)) {
        setError(t('teams.createModal.slugReserved'));
        return;
      }
      setSubmitting(true);
      try {
        const check = await api.checkTeamSlug(finalSlug);
        if (!check.available) {
          setError(
            check.reason === 'reserved'
              ? t('teams.createModal.slugReserved')
              : check.reason === 'invalid'
                ? t('teams.createModal.slugInvalid')
                : t('teams.createModal.slugTaken'),
          );
          setSlugStatus(
            check.reason === 'reserved'
              ? { kind: 'reserved' }
              : check.reason === 'invalid'
                ? { kind: 'invalid' }
                : { kind: 'taken', suggestion: check.suggestion },
          );
          setSubmitting(false);
          return;
        }
      } catch (err) {
        setError(getErrorMessage(err, t('teams.createModal.createError')));
        setSubmitting(false);
        return;
      }
      submitSlug = finalSlug;
    }
    setSubmitting(true);
    try {
      const trimmedIcon = icon.trim() || null;
      const team = await createTeam(trimmedName, trimmedIcon, submitSlug);
      setName('');
      setIcon('');
      setSlugInput('');
      setSlugTouched(false);
      onClose();
      // Tour rule: stay on the dashboard so the wizard can continue
      // (default flow navigates to the new team workspace route).
      if (isTourActive()) {
        navigate('/', { replace: false });
      } else {
        navigate(`/${encodeURIComponent(team.slug)}/projects`);
      }
    } catch (err) {
      setError(getErrorMessage(err, t('teams.createModal.createError')));
      setSubmitting(false);
    }
  }

  const slugHelper =
    slugStatus.kind === 'available'
      ? t('teams.createModal.slugAvailable', { slug: previewSlug })
      : slugStatus.kind === 'checking'
        ? t('teams.createModal.slugChecking')
        : slugStatus.kind === 'taken'
          ? t('teams.createModal.slugTaken')
          : slugStatus.kind === 'reserved'
            ? t('teams.createModal.slugReserved')
            : slugStatus.kind === 'invalid'
              ? t('teams.createModal.slugInvalid')
              : !slugTouched && !autoValid
                ? t('teams.createModal.slugFallbackNote')
                : t('teams.createModal.slugHelper', { slug: previewSlug });

  return (
    <Modal
      open={open}
      title={t('teams.createModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-team-form"
            leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />}
            loading={submitting}
            disabled={!name.trim() || slugBlocked || submitting}
          >
            {t('teams.createModal.create')}
          </Button>
        </>
      }
    >
      <form id="create-team-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <p className="modal-copy">{t('teams.createModal.intro')}</p>
        <div className="form-row">
          <div style={{ flex: '0 0 96px' }}>
            <Input
              label={t('teams.createModal.icon')}
              value={icon}
              placeholder="😀"
              maxLength={FE_LIMITS.TEAM_ICON}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label={t('teams.createModal.name')}
              required
              autoFocus
              placeholder={t('teams.createModal.namePlaceholder')}
              value={name}
              maxLength={FE_LIMITS.TEAM_NAME}
              showCount
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="team-slug">
          <Input
            label={t('teams.createModal.slug')}
            value={slugTouched ? slugInput : autoValid ? autoBase : ''}
            placeholder={autoValid ? autoBase : 'team-xxxx'}
            maxLength={TEAM_SLUG_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            helper={slugHelper}
            error={
              slugStatus.kind === 'taken' || slugStatus.kind === 'reserved' || slugStatus.kind === 'invalid'
                ? slugHelper
                : undefined
            }
            onChange={(e) => {
              setSlugTouched(true);
              setSlugInput(e.target.value.toLowerCase());
            }}
            aria-describedby="create-team-slug-preview"
          />
          <p id="create-team-slug-preview" className="team-slug__preview" aria-live="polite">
            <span className="team-slug__preview-path" aria-hidden="true">
              /{previewSlug}/projects
            </span>
            <span className="sr-only">{t('teams.createModal.slugHelper', { slug: previewSlug })}</span>
            <span
              className={
                slugStatus.kind === 'available'
                  ? 'team-slug__dot team-slug__dot--available'
                  : slugStatus.kind === 'checking'
                    ? 'team-slug__dot team-slug__dot--checking'
                    : slugStatus.kind === 'taken' ||
                        slugStatus.kind === 'reserved' ||
                        slugStatus.kind === 'invalid'
                      ? 'team-slug__dot team-slug__dot--taken'
                      : 'team-slug__dot'
              }
              aria-hidden="true"
            />
          </p>
          {slugStatus.kind === 'taken' && slugStatus.suggestion && (
            <button
              type="button"
              className="team-slug__suggestion"
              onClick={() => {
                setSlugTouched(true);
                setSlugInput(slugStatus.suggestion ?? '');
              }}
            >
              {t('teams.createModal.slugUseSuggestion', { suggestion: slugStatus.suggestion })}
            </button>
          )}
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  );
}
