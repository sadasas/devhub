import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FloppyDisk } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { Team } from '../../lib/types';
import {
  TEAM_SLUG_MAX_LENGTH,
  isReservedTeamSlug,
  isValidTeamSlugFormat,
  normalizeTeamSlug,
} from '../../lib/team-slug';
import { FE_LIMITS } from '../../lib/limits';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken'; suggestion: string | null }
  | { kind: 'reserved' }
  | { kind: 'invalid' };

// General tim sebagai modal (cermin EditGeneralModal proyek): draft segar
// tiap dibuka, validasi nama + slug (format, reserved, taken via debounce),
// pre-check server sebelum tulis, renameTeam lalu renameSlug.
export function EditTeamGeneralModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const { t } = useTranslation('account');
  const { renameTeam, renameSlug } = useTeams();
  const [nameDraft, setNameDraft] = useState(team.name);
  const [iconDraft, setIconDraft] = useState(team.icon ?? '');
  const [slugDraft, setSlugDraft] = useState(team.slug ?? '');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const slugSeq = useRef(0);
  const n = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  const nameTrimmed = nameDraft.trim();
  const iconTrimmed = iconDraft.trim();
  const slugTrimmed = normalizeTeamSlug(slugDraft);
  const savedIcon = (team.icon ?? '').trim();
  const savedSlug = team.slug ?? '';
  const nameDirty = nameTrimmed !== team.name.trim() || (iconTrimmed || '') !== (savedIcon || '');
  const slugDirty = slugTrimmed !== savedSlug;
  const isDirty = nameDirty || slugDirty;
  const slugInvalid = slugDirty && slugTrimmed.length > 0 && !isValidTeamSlugFormat(slugTrimmed);
  const slugReserved = slugDirty && !slugInvalid && isReservedTeamSlug(slugTrimmed);
  const slugTaken = slugStatus.kind === 'taken';
  const slugBlocked = slugDirty && (slugInvalid || slugReserved || slugTaken || slugTrimmed.length === 0);
  const canSave = isDirty && nameTrimmed.length > 0 && !saving && !slugBlocked;

  // Debounced uniqueness check untuk slug draft (400ms, member-safe via
  // excludeTeamId sehingga slug saat ini tak pernah dilaporkan taken).
  useEffect(() => {
    if (!slugDirty || !slugTrimmed) {
      setSlugStatus({ kind: 'idle' });
      return;
    }
    if (!isValidTeamSlugFormat(slugTrimmed)) {
      setSlugStatus({ kind: 'invalid' });
      return;
    }
    if (isReservedTeamSlug(slugTrimmed)) {
      setSlugStatus({ kind: 'reserved' });
      return;
    }
    setSlugStatus({ kind: 'checking' });
    const seq = (slugSeq.current += 1);
    const timer = setTimeout(() => {
      void api
        .checkTeamSlug(slugTrimmed, team.id)
        .then((res) => {
          if (slugSeq.current !== seq) return;
          if (res.available) setSlugStatus({ kind: 'available' });
          else if (res.reason === 'reserved') setSlugStatus({ kind: 'reserved' });
          else if (res.reason === 'invalid') setSlugStatus({ kind: 'invalid' });
          else setSlugStatus({ kind: 'taken', suggestion: res.suggestion });
        })
        .catch(() => {
          if (slugSeq.current === seq) setSlugStatus({ kind: 'idle' });
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [slugTrimmed, slugDirty, team.id]);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Final server check closes the debounce race before any write.
      if (slugDirty) {
        const check = await api.checkTeamSlug(slugTrimmed, team.id);
        if (!check.available) {
          setSlugStatus(
            check.reason === 'reserved'
              ? { kind: 'reserved' }
              : check.reason === 'invalid'
                ? { kind: 'invalid' }
                : { kind: 'taken', suggestion: check.suggestion },
          );
          setSaveError(
            check.reason === 'reserved'
              ? t('dashboard.team.settingsSlugReserved')
              : check.reason === 'invalid'
                ? t('dashboard.team.settingsSlugInvalid')
                : t('dashboard.team.settingsSlugTaken'),
          );
          setSaving(false);
          return;
        }
      }
      if (nameDirty) {
        await renameTeam(team.id, nameTrimmed, iconTrimmed ? iconTrimmed : null);
      }
      if (slugDirty) {
        await renameSlug(team.id, slugTrimmed);
      }
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('teams.errors.rename')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={t('dashboard.team.settingsEditGeneralTitle', { defaultValue: 'Edit general' })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            {t('common:action.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="submit"
            size="md"
            form="edit-team-general-form"
            leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
            loading={saving}
            disabled={!canSave}
          >
            {t('dashboard.team.settingsSave')}
          </Button>
        </>
      }
    >
      <form
        id="edit-team-general-form"
        className="form-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="dashboard__settings-row">
          <div className="dashboard__settings-field dashboard__settings-field--icon">
            <Input
              label={t('dashboard.team.settingsIconLabel')}
              value={iconDraft}
              maxLength={FE_LIMITS.TEAM_ICON}
              placeholder="😀"
              onChange={(e) => setIconDraft(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="dashboard__settings-field dashboard__settings-field--name">
            <Input
              label={t('dashboard.team.settingsNameLabel')}
              required
              value={nameDraft}
              maxLength={FE_LIMITS.TEAM_NAME}
              showCount
              autoFocus={n}
              onChange={(e) => setNameDraft(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="dashboard__settings-field dashboard__settings-field--slug team-slug">
          <Input
            label={t('dashboard.team.settingsSlugLabel')}
            value={slugDraft}
            maxLength={TEAM_SLUG_MAX_LENGTH}
            onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
            autoComplete="off"
            spellCheck={false}
            helper={
              slugStatus.kind === 'checking'
                ? t('dashboard.team.settingsSlugChecking')
                : slugStatus.kind === 'available'
                  ? t('dashboard.team.settingsSlugAvailable')
                  : slugStatus.kind === 'taken'
                    ? t('dashboard.team.settingsSlugTaken')
                    : slugStatus.kind === 'reserved'
                      ? t('dashboard.team.settingsSlugReserved')
                      : slugStatus.kind === 'invalid'
                        ? t('dashboard.team.settingsSlugInvalid')
                        : undefined
            }
            error={
              slugStatus.kind === 'taken' ||
              slugStatus.kind === 'reserved' ||
              slugStatus.kind === 'invalid'
                ? slugStatus.kind === 'taken'
                  ? t('dashboard.team.settingsSlugTaken')
                  : slugStatus.kind === 'reserved'
                    ? t('dashboard.team.settingsSlugReserved')
                    : t('dashboard.team.settingsSlugInvalid')
                : undefined
            }
            aria-describedby="edit-team-slug-preview edit-team-slug-status"
          />
          <p id="edit-team-slug-preview" className="team-slug__preview">
            <span className="team-slug__preview-path" aria-hidden="true" title={`/${slugTrimmed || savedSlug || 'team-xxxx'}/projects`}>
              /{slugTrimmed || savedSlug || 'team-xxxx'}/projects
            </span>
            <span className="sr-only">
              {t('dashboard.team.settingsSlugHelper', { slug: slugTrimmed || savedSlug || 'team-xxxx' })}
            </span>
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
          <span id="edit-team-slug-status" role="status" className="sr-only">
            {slugStatus.kind === 'checking'
              ? t('dashboard.team.settingsSlugChecking')
              : slugStatus.kind === 'available'
                ? t('dashboard.team.settingsSlugAvailable')
                : slugStatus.kind === 'taken'
                  ? t('dashboard.team.settingsSlugTaken')
                  : slugStatus.kind === 'reserved'
                    ? t('dashboard.team.settingsSlugReserved')
                    : slugStatus.kind === 'invalid'
                      ? t('dashboard.team.settingsSlugInvalid')
                      : ''}
          </span>
          {slugStatus.kind === 'taken' && slugStatus.suggestion && (
            <button
              type="button"
              className="team-slug__suggestion"
              onClick={() => setSlugDraft(slugStatus.suggestion ?? '')}
            >
              {t('dashboard.team.settingsSlugUseSuggestion', { suggestion: slugStatus.suggestion })}
            </button>
          )}
        </div>
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}
