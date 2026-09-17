import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowSquareOut, Check, ClockCounterClockwise, Copy, FloppyDisk, GearSix, SignOut, Tag, Trash } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingStatus, Team } from '../../lib/types';
import {
  TEAM_SLUG_MAX_LENGTH,
  isReservedTeamSlug,
  isValidTeamSlugFormat,
  normalizeTeamSlug,
} from '../../lib/team-slug';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { DataErrorState } from '../../components/DataErrorState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { UsageMeter } from '../../components/UsageMeter';
import { FE_LIMITS } from '../../lib/limits';
import { normalizeSettingsSection } from './settingsSections';

interface DashboardSettingsTabProps {
  team: Team;
  onBackToProjects: () => void;
}

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken'; suggestion: string | null }
  | { kind: 'reserved' }
  | { kind: 'invalid' };

// Settings shell sections (?section=) live in the shared lib so the main
// sidebar nav (SettingsNav) and this panel resolve the same keys.

function formatQuota(used: number, limit: number | null): string {
  if (limit === null) return `${used} / ∞`;
  return `${used} / ${limit}`;
}

// Settings tab scoped to the already-resolved active team.
// Mirrors TeamPage patterns (rename + billing + leave/delete) as inline
// sections in a 720px left-aligned container without touching routes or API.
// Shell (Linear-style): sidebar nav (?section=general|plan|usage|danger)
// renders one section at a time; drafts and dialog state live here so
// switching sections never loses them.
// DECISION: TeamBillingPanel is NOT embedded here. It is a full billing
// cockpit (pending payments, scheduled downgrade, cancel flows). The
// dashboard needs a concise summary only, so this tab fetches billingStatus
// once and renders 3 stats + UsageMeter bars with links to /pricing
// (checkout detail) and /payments (history). This keeps the tab lightweight
// and avoids duplicating cancel dialog logic.
// NOTE: type-to-confirm Delete uses a custom Modal + Input + Button because
// ConfirmDeleteDialog has no text-input slot; Leave mirrors the TeamPage
// Modal dialog verbatim.
export function DashboardSettingsTab({ team, onBackToProjects }: DashboardSettingsTabProps) {
  const { t } = useTranslation('account');
  const { renameTeam, renameSlug, deleteTeam, refresh } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { copied, copy: copyText } = useCopyFeedback();
  const [searchParams, setSearchParams] = useSearchParams();

  // Canonicalize the legacy deep-link (?tab=settings&section=billing) to
  // the Usage section once; unknown values fall back to General (no scroll
  // needed — the shell renders one section at a time).
  useEffect(() => {
    if (searchParams.get('section') === 'billing') {
      setSearchParams({ section: 'usage' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeSection = normalizeSettingsSection(searchParams.get('section'));

  // Sidebar nav links change ?section= via navigation; move keyboard focus
  // to the new section heading (skipped on initial load).
  const firstSectionRender = useRef(true);
  useEffect(() => {
    if (firstSectionRender.current) {
      firstSectionRender.current = false;
      return;
    }
    const el = document.getElementById(`dashboard-settings-${activeSection}-title`);
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [activeSection]);

  const isOwner = team.role === 'owner';
  const isAdmin = team.role === 'owner' || team.role === 'admin';
  const isViewer = team.role === 'viewer';
  // Backend enforces admin for rename (assertAdmin) and owner for delete
  // (assertOwner). Editors get a read-only General form with helper text.
  const canEditGeneral = isAdmin;
  const canDelete = isOwner;

  // General form state mirrors TeamPage rename modal fields as inline inputs.
  const [nameDraft, setNameDraft] = useState(team.name);
  const [iconDraft, setIconDraft] = useState(team.icon ?? '');
  const [slugDraft, setSlugDraft] = useState(team.slug ?? '');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const slugSeq = useRef(0);

  // Reset drafts whenever the active team switches.
  useEffect(() => {
    setNameDraft(team.name);
    setIconDraft(team.icon ?? '');
    setSlugDraft(team.slug ?? '');
    setSlugStatus({ kind: 'idle' });
    setSaveError(null);
    setCopyError(null);
  }, [team.id, team.name, team.icon, team.slug]);

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
  const canSave = canEditGeneral && isDirty && nameTrimmed.length > 0 && !saving && !slugBlocked;

  // Debounced uniqueness check for the slug draft (400ms, member-safe via
  // excludeTeamId so keeping the current slug never reports taken).
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

  async function handleCopyId() {
    const ok = await copyText(team.id);
    if (!ok) setCopyError(t('dashboard.team.copyFailed'));
    else setCopyError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    } catch (err) {
      setSaveError(getErrorMessage(err, t('teams.errors.rename')));
    } finally {
      setSaving(false);
    }
  }

  // Shared billing fetch for Plan + Usage sections (single call per team).
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingErrorRaw, setBillingErrorRaw] = useState<unknown>(null);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);
    setBillingErrorRaw(null);
    try {
      const status = await api.billingStatus(team.id);
      setBilling(status);
    } catch (err) {
      setBillingError(getErrorMessage(err, t('teams.billing.loadError')));
      setBillingErrorRaw(err);
    } finally {
      setBillingLoading(false);
    }
  }, [team.id, t]);

  useEffect(() => {
    setBilling(null);
    void loadBilling();
  }, [loadBilling]);

  const plan = billing?.team.plan ?? team.plan;
  const planName = billing?.team.planPackageName ?? team.planPackageName;
  const expires = billing?.team.planExpiresAt ?? null;
  const expiryMeta = billingLoading
    ? null
    : plan === 'pro'
      ? (expires
        ? t('teams.billing.activeUntil', { date: new Date(expires).toLocaleDateString() })
        : t('teams.billing.activeNoExpiry'))
      : t('teams.billing.freePlan');

  // Danger zone state (custom Modal dialogs, same copy as TeamPage).
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset danger dialogs on team switch.
  useEffect(() => {
    setLeaveOpen(false);
    setLeaveError(null);
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeleteError(null);
  }, [team.id]);

  async function handleConfirmLeave() {
    if (!user) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await api.removeMember(team.id, user.id);
      await refresh();
      setLeaveOpen(false);
      navigate('/');
    } catch (err) {
      setLeaveError(getErrorMessage(err, t('teams.errors.leave')));
    } finally {
      setLeaving(false);
    }
  }

  const deleteMatches = deleteConfirm.trim() === team.name;
  const deleteMismatch = deleteConfirm.length > 0 && !deleteMatches;

  async function handleConfirmDelete() {
    if (!deleteMatches || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTeam(team.id);
      setDeleteOpen(false);
      navigate('/');
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('teams.errors.deleteTeam')));
      setDeleting(false);
    }
  }

  // Double-guard: DashboardPage hides the tab for viewers, but a direct
  // ?tab=settings URL must still render no-access instead of the form.
  if (isViewer) {
    return (
      <section
        className="tab-panel dashboard__settings"
        role="tabpanel"
        id="dashboard-tabpanel-settings"
        aria-labelledby="dashboard-tab-settings"
      >
        <article className="pcard">
        <div className="pcard-body">
        <div className="narrow-center">
        <EmptyState
          icon={<GearSix size={22} weight="duotone" aria-hidden="true" />}
          title={t('dashboard.team.settingsNoAccessTitle')}
          description={t('dashboard.team.settingsNoAccessDesc')}
          action={
            <Button variant="secondary" size="sm" className="dashboard__settings-noaccess-cta" onClick={onBackToProjects}>
              {t('dashboard.team.settingsNoAccessCta')}
            </Button>
          }
        />
        </div>
        </div>
        </article>
      </section>
    );
  }

  return (
    <section
      className="tab-panel dashboard__settings"
      role="tabpanel"
      id="dashboard-tabpanel-settings"
      aria-labelledby="dashboard-tab-settings"
    >
      <article className="pcard settings-content-card">
      <div className="pcard-body">
      <div className="narrow-center">
      {/* General: inline name + icon + URL slug + read-only ID, dirty-gated save. */}
      {activeSection === 'general' && (
      <section className="dashboard__settings-section" aria-labelledby="dashboard-settings-general-title">
        <h2 id="dashboard-settings-general-title" tabIndex={-1} className="dashboard__settings-section-title">
          {t('dashboard.team.settingsGeneralTitle')}
        </h2>
        <p className="dashboard__settings-section-desc">{t('dashboard.team.settingsGeneralDesc')}</p>
        <form className="dashboard__settings-form" onSubmit={(e) => void handleSave(e)} noValidate>
          <div className="dashboard__settings-row">
            <div className="dashboard__settings-field dashboard__settings-field--icon">
              <Input
                label={t('dashboard.team.settingsIconLabel')}
                value={iconDraft}
                maxLength={FE_LIMITS.TEAM_ICON}
                placeholder="😀"
                onChange={(e) => setIconDraft(e.target.value)}
                disabled={!canEditGeneral}
                autoComplete="off"
              />
            </div>
            <div className="dashboard__settings-field dashboard__settings-field--name">
              <Input
                label={t('dashboard.team.settingsNameLabel')}
                required
                value={nameDraft}
                maxLength={FE_LIMITS.TEAM_NAME}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={!canEditGeneral}
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
              disabled={!canEditGeneral}
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
              aria-describedby="dashboard-settings-slug-preview dashboard-settings-slug-status"
            />
            <p id="dashboard-settings-slug-preview" className="team-slug__preview">
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
            <span id="dashboard-settings-slug-status" role="status" className="sr-only">
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
            {slugStatus.kind === 'taken' && slugStatus.suggestion && canEditGeneral && (
              <button
                type="button"
                className="team-slug__suggestion"
                onClick={() => setSlugDraft(slugStatus.suggestion ?? '')}
              >
                {t('dashboard.team.settingsSlugUseSuggestion', { suggestion: slugStatus.suggestion })}
              </button>
            )}
          </div>
          <div className="dashboard__settings-id-row">
            <div className="dashboard__settings-id-field">
              <Input
                label={t('dashboard.team.settingsIdLabel')}
                value={team.id}
                readOnly
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="dashboard__settings-copy"
              leftIcon={copied ? <Check size={14} weight="bold" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              onClick={() => void handleCopyId()}
              aria-live="polite"
              aria-label={copied ? (t('dashboard.team.settingsCopied') as string) : (t('dashboard.team.settingsCopyId') as string)}
            >
              {copied ? t('dashboard.team.settingsCopied') : t('dashboard.team.settingsCopyId')}
            </Button>
          </div>
          {copyError && <InlineError>{copyError}</InlineError>}
          {saveError && <InlineError>{saveError}</InlineError>}
          <div className="dashboard__settings-save-row">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="dashboard__settings-save"
              leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
              loading={saving}
              disabled={!canSave}
            >
              {t('dashboard.team.settingsSave')}
            </Button>
            {isDirty && canEditGeneral && nameTrimmed.length > 0 && (
              <span className="dashboard__settings-unsaved" role="status">
                {t('dashboard.team.settingsUnsaved')}
              </span>
            )}
          </div>
          {!canEditGeneral && (
            <p className="dashboard__settings-helper">{t('dashboard.team.settingsReadOnlyHelper')}</p>
          )}
        </form>
      </section>
      )}

      {/* Plan: package row + seat/project quotas + Manage (new tab). */}
      {activeSection === 'plan' && (
      <section className="dashboard__settings-section" aria-labelledby="dashboard-settings-plan-title">
        <h2 id="dashboard-settings-plan-title" tabIndex={-1} className="dashboard__settings-section-title">
          {t('dashboard.team.settingsPlanTitle')}
        </h2>
        <p className="dashboard__settings-section-desc">{t('dashboard.team.settingsPlanDesc')}</p>
        <div className="dashboard__settings-plan-row">
          <div className="dashboard__settings-plan-main">
            <span className="dashboard__settings-plan-name">{planName}</span>
            <Badge tone={plan === 'pro' ? 'info' : 'neutral'}>
              {plan === 'pro' ? t('teams.billing.activeBadge') : t('teams.billing.free')}
            </Badge>
            {billingLoading ? (
              <Skeleton className="settings-skeleton-line settings-skeleton-line--plan" />
            ) : (
              expiryMeta && <span className="dashboard__settings-plan-meta">{expiryMeta}</span>
            )}
          </div>
        </div>
        <div className="dashboard__settings-plan-quota">
          {billingLoading ? (
            <Skeleton className="settings-skeleton-line settings-skeleton-line--quota" />
          ) : billing && !billingError ? (
            <span className="dashboard__settings-plan-quota-text">
              {t('teams.billing.members')}: {formatQuota(billing.usage.members.used, billing.usage.members.limit)}
              <span aria-hidden="true"> · </span>
              {t('teams.billing.projects')}: {formatQuota(billing.usage.projects.used, billing.usage.projects.limit)}
            </span>
          ) : (
            <span className="dashboard__settings-plan-quota-text">{t('teams.billing.loadError')}</span>
          )}
        </div>
        <div className="dashboard__settings-plan-manage-row">
          <a
            className="btn btn-secondary btn-sm dashboard__settings-manage"
            href={`/pricing?teamId=${encodeURIComponent(team.id)}`}
            target="_blank"
            rel="noreferrer"
            aria-label={t('dashboard.team.settingsPlanManageAria', { name: team.name })}
          >
            <ArrowSquareOut size={13} weight="bold" aria-hidden="true" />
            {t('dashboard.team.settingsPlanManage')}
          </a>
        </div>
      </section>
      )}

      {/* Usage: concise 3 stats + bars, links stay on /pricing and /payments. */}
      {activeSection === 'usage' && (
      <section id="dashboard-settings-usage" className="dashboard__settings-section" aria-labelledby="dashboard-settings-usage-title">
        <h2 id="dashboard-settings-usage-title" tabIndex={-1} className="dashboard__settings-section-title">
          {t('dashboard.team.settingsUsageTitle')}
        </h2>
        <p className="dashboard__settings-section-desc">{t('dashboard.team.settingsUsageDesc')}</p>
        {billingLoading ? (
          <div
            className="dashboard__settings-usage-loading"
            role="status"
            aria-busy="true"
          >
            <span className="sr-only">{t('dashboard.team.settingsUsageLoading')}</span>
            <div aria-hidden="true" className="dashboard__settings-usage-skeleton">
              <div className="dashboard__settings-stats">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="dashboard__settings-stat">
                    <Skeleton className="settings-skeleton-stat-value" />
                    <Skeleton className="settings-skeleton-stat-sub" />
                  </div>
                ))}
              </div>
              <div className="dashboard__settings-meters">
                {[0, 1].map((i) => (
                  <div key={i} className="settings-skeleton-meter">
                    <Skeleton className="settings-skeleton-meter-name" />
                    <Skeleton className="settings-skeleton-meter-bar" />
                    <Skeleton className="settings-skeleton-meter-value" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : billingError || !billing ? (
          <DataErrorState error={billingErrorRaw ?? billingError ?? t('teams.billing.loadError')} onRetry={() => void loadBilling()} retryLabel={t('dashboard.team.membersRetry')} />
        ) : (
          <>
            <div className="dashboard__settings-stats" role="list" aria-label={t('dashboard.team.settingsUsageStatsAria')}>
              <div className="dashboard__settings-stat" role="listitem">
                <span className="dashboard__settings-stat-value tabular">
                  {formatQuota(billing.usage.members.used, billing.usage.members.limit)}
                </span>
                <span className="dashboard__settings-stat-label">{t('teams.billing.members')}</span>
              </div>
              <div className="dashboard__settings-stat" role="listitem">
                <span className="dashboard__settings-stat-value tabular">
                  {formatQuota(billing.usage.projects.used, billing.usage.projects.limit)}
                </span>
                <span className="dashboard__settings-stat-label">{t('teams.billing.projects')}</span>
              </div>
              <div className="dashboard__settings-stat" role="listitem">
                <span className="dashboard__settings-stat-value">{planName}</span>
                <span className="dashboard__settings-stat-label">{t('teams.billing.currentPlan')}</span>
              </div>
            </div>
            <div className="dashboard__settings-meters">
              <UsageMeter
                label={t('teams.billing.members')}
                used={billing.usage.members.used}
                limit={billing.usage.members.limit}
              />
              <UsageMeter
                label={t('teams.billing.projects')}
                used={billing.usage.projects.used}
                limit={billing.usage.projects.limit}
              />
            </div>
            <div className="dashboard__settings-usage-links">
              <Link
                className="btn btn-ghost btn-sm dashboard__settings-link"
                to={`/pricing?teamId=${encodeURIComponent(team.id)}`}
              >
                <Tag size={14} aria-hidden="true" />
                {t('teams.billing.viewPricing')}
              </Link>
              <Link className="btn btn-ghost btn-sm dashboard__settings-link" to="/payments">
                <ClockCounterClockwise size={14} aria-hidden="true" />
                {t('dashboard.team.settingsUsageViewHistory')}
              </Link>
            </div>
          </>
        )}
      </section>
      )}

      {/* Danger zone: Leave (non-owner) + Delete (owner with typed confirm). */}
      {activeSection === 'danger' && (
      <section
        className="dashboard__settings-section dashboard__settings-section--danger"
        aria-labelledby="dashboard-settings-danger-title"
      >
        <h2 id="dashboard-settings-danger-title" tabIndex={-1} className="dashboard__settings-section-title dashboard__settings-section-title--danger">
          {t('dashboard.team.settingsDangerTitle')}
        </h2>
        <p className="dashboard__settings-section-desc">{t('dashboard.team.settingsDangerDesc')}</p>
        <div className="dashboard__settings-danger-row">
          <div className="dashboard__settings-danger-main">
            <h3 className="dashboard__settings-danger-name">{t('teams.leaveTeam')}</h3>
            <p className="dashboard__settings-danger-copy">{t('dashboard.team.settingsLeaveDesc')}</p>
            {isOwner && (
              <p id="leave-owner-hint" className="dashboard__settings-helper">{t('dashboard.team.settingsLeaveOwnerHelper')}</p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="dashboard__settings-danger-btn"
            leftIcon={<SignOut size={14} aria-hidden="true" />}
            disabled={isOwner}
            aria-describedby={isOwner ? 'leave-owner-hint' : undefined}
            title={isOwner ? t('dashboard.team.settingsLeaveOwnerHelper') : undefined}
            onClick={() => {
              setLeaveError(null);
              setLeaveOpen(true);
            }}
          >
            {t('teams.leaveTeam')}
          </Button>
        </div>
        {canDelete && (
          <div className="dashboard__settings-danger-row dashboard__settings-danger-row--delete">
            <div className="dashboard__settings-danger-main">
              <h3 className="dashboard__settings-danger-name">{t('teams.deleteTeam')}</h3>
              <p className="dashboard__settings-danger-copy">{t('dashboard.team.settingsDeleteDesc')}</p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="dashboard__settings-danger-btn"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirm('');
                setDeleteOpen(true);
              }}
            >
              {t('teams.deleteTeam')}
            </Button>
          </div>
        )}
      </section>
      )}

      </div>
      </div>
      </article>
      {/* Leave dialog reuses Modal (same copy as TeamPage/DashboardPage). */}
      <Modal
        open={leaveOpen}
        title={t('teams.leaveModal.title')}
        onClose={() => {
          if (!leaving) {
            setLeaveOpen(false);
            setLeaveError(null);
          }
        }}
        width="sm"
        ariaDescribedBy="leave-desc"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setLeaveOpen(false)} disabled={leaving}>
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="danger"
              size="md"
              leftIcon={<SignOut size={14} aria-hidden="true" />}
              loading={leaving}
              onClick={() => void handleConfirmLeave()}
            >
              {t('teams.leaveModal.confirm')}
            </Button>
          </>
        }
      >
        <p id="leave-desc" className="modal-copy">{t('teams.leaveModal.body', { name: team.name })}</p>
        {leaveError && <InlineError>{leaveError}</InlineError>}
      </Modal>

      {/* Delete dialog reuses Modal + Input + Button with typed confirmation. */}
      <Modal
        open={deleteOpen}
        title={t('dashboard.team.settingsDeleteModalTitle')}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
        width="sm"
        ariaDescribedBy="delete-desc"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              loading={deleting}
              disabled={!deleteMatches}
              aria-describedby={deleteMismatch ? 'delete-confirm-input-error' : undefined}
              onClick={() => void handleConfirmDelete()}
            >
              {t('common:action.delete')}
            </Button>
          </>
        }
      >
        <p id="delete-desc" className="modal-copy">{t('dashboard.team.settingsDeleteModalBody', { name: team.name })}</p>
        <div className="dashboard__settings-delete-field">
          <Input
            id="delete-confirm-input"
            label={t('dashboard.team.settingsNameLabel')}
            value={deleteConfirm}
            maxLength={FE_LIMITS.TEAM_NAME}
            placeholder={t('dashboard.team.settingsDeleteModalPlaceholder')}
            error={deleteMismatch ? (t('dashboard.team.settingsDeleteModalMismatch') as string) : undefined}
            aria-describedby="delete-desc"
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
          />
        </div>
        {deleteError && <InlineError>{deleteError}</InlineError>}
      </Modal>
    </section>
  );
}
