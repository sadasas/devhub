import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, GithubLogo, PlugsConnected } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import {
  DOCS_PRIVACY_URL,
  DOCS_TERMS_URL,
  GITHUB_INSTALLATIONS_URL,
  GITHUB_PRIVACY_URL,
} from '../../lib/docs-urls';
import type { GitHubAutomation, GitHubInstallation, GitHubInstallationRepo, GitHubStatus } from '../../lib/types';
import { savePendingReturn } from '../../lib/github';
import { Button } from '../../components/Button';
import { DataErrorState } from '../../components/DataErrorState';
import { SearchableSelect } from '../../components/SearchableSelect';
import { StatusBanner } from '../../components/StatusBanner';

/** Error code server saat GitHub App belum dikonfigurasi (duck-typing agar aman di test mock). */
function isNotConfiguredError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'GITHUB_NOT_CONFIGURED'
  );
}

interface GitHubSettingsProps {
  projectId: string;
  canConnect: boolean;
  isAdmin: boolean;
}

/**
 * Disclosure fokus fitur: fitur yang dipakai + akses + legal secukupnya.
 * SATU blok grup (gap internal 4px) dalam ritme luar 12px — cermin pola
 * danger-name -> copy. Klaim hanya dari kode: webhook push/PR/review/checks
 * + komentar linkback (webhook-service.ts), token instalasi ~1 jam (github-app.ts),
 * mode automation (link-service.ts), DEV keys (domain/github.ts).
 */
function GitHubDisclosure() {
  const { t } = useTranslation('project');
  return (
    <div className="integration-disclosure">
      <p className="field-helper">
        {t('settings.githubFeatures1', {
          defaultValue:
            'Links PRs, commits and branches to tasks automatically via DEV keys, with a linkback comment on first-linked PRs.',
        })}
      </p>
      <p className="field-helper">
        {t('settings.githubFeatures2', {
          defaultValue:
            'Syncs review and CI status to linked tasks, with status automation (Auto / Suggest / Off) and retry for failed syncs.',
        })}
      </p>
      <p className="field-helper">
        {t('settings.githubAccess', {
          defaultValue:
            'DevHub reads PR, commit, check and review metadata on the connected repo via webhooks and the GitHub API. Access uses a short-lived GitHub App token — your GitHub password is never stored.',
        })}
      </p>
      <p className="field-helper">
        {t('settings.githubLegalPrefix', { defaultValue: 'Details:' })}{' '}
        <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">
          {t('settings.githubPrivacyLink', { defaultValue: 'Privacy Policy' })}
        </a>
        {' · '}
        <a href={DOCS_TERMS_URL} target="_blank" rel="noopener">
          {t('settings.githubTermsLink', { defaultValue: 'Terms' })}
        </a>
        {' · '}
        <a href={GITHUB_INSTALLATIONS_URL} target="_blank" rel="noopener">
          {t('settings.githubRevokeLink', { defaultValue: 'GitHub App settings' })}
        </a>
        {' · '}
        <a href={GITHUB_PRIVACY_URL} target="_blank" rel="noopener">
          {t('settings.githubSideLink', { defaultValue: "GitHub's policies" })}
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Panel GitHub di Project settings (gantikan placeholder "coming soon").
 * Connect/install wajib owner/admin (server 403 untuk lainnya); editor boleh
 * baca status. Setup flow: tombol Connect -> github.com install -> redirect
 * ke Setup URL frontend (?github=installed&installation_id=) -> picker repo.
 */
export function GitHubSettings({ projectId, canConnect, isAdmin }: GitHubSettingsProps) {
  const { t } = useTranslation('project');
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingInstall, setPendingInstall] = useState<{ installationId: number; repos: GitHubInstallationRepo[] } | null>(null);
  const [picked, setPicked] = useState('');
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[] | null>(null);
  const [pickedInstallation, setPickedInstallation] = useState<number | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.githubStatus(projectId));
    } catch (e) {
      if (isNotConfiguredError(e)) {
        // Opsi B: NOT_CONFIGURED hanya diwakili banner warn persisten —
        // jangan isi error generik agar tidak tampil dobel.
        setUnconfigured(true);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load GitHub status');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Selesaikan setup redirect GitHub (?github=installed&installation_id=...).
  useEffect(() => {
    if (searchParams.get('github') !== 'installed') return;
    const installationId = Number(searchParams.get('installation_id'));
    if (!Number.isInteger(installationId) || installationId <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        await api.githubSetup(installationId, searchParams.get('setup_action') ?? undefined);
        const { repos } = await api.githubInstallRepos(installationId);
        if (!cancelled) {
          setPendingInstall({ installationId, repos });
          setPicked(repos[0] ? `${repos[0].owner}/${repos[0].repo}` : '');
        }
      } catch (e) {
        if (isNotConfiguredError(e)) {
          setUnconfigured(true);
          if (!cancelled) setError(null);
        } else if (!cancelled) {
          setError(e instanceof Error ? e.message : 'GitHub setup failed');
        }
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams);
          next.delete('github');
          next.delete('installation_id');
          next.delete('setup_action');
          setSearchParams(next, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Flash dari kembalian Gate (?github=connected&repo= / ?github_error=):
  // konsumsi sekali lalu bersihkan URL (cermin pola GCal ?gcal=connected).
  useEffect(() => {
    const connected = searchParams.get('github') === 'connected';
    const err = searchParams.get('github_error');
    if (!connected && !err) return;
    if (connected) {
      const repo = searchParams.get('repo');
      setFlash({
        tone: 'success',
        text: t('settings.githubConnectedFlash', {
          defaultValue: 'GitHub connected{{repo}}.',
          repo: repo ? `: ${repo}` : '',
        }),
      });
    } else {
      setFlash({
        tone: 'error',
        text: err || t('settings.githubFailed', { defaultValue: 'Connection failed.' }),
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete('github');
    next.delete('repo');
    next.delete('github_error');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daftar instalasi untuk picker tanpa redirect (State B): hanya saat
  // belum connected dan user admin — member cukup baca status.
  useEffect(() => {
    if (!status || status.connected || !isAdmin || installations !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const { installations: rows } = await api.githubInstallations();
        if (!cancelled) {
          setInstallations(rows);
          setUnconfigured(false);
        }
      } catch (e) {
        if (isNotConfiguredError(e)) setUnconfigured(true);
        if (!cancelled) setInstallations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, isAdmin, installations]);

  async function selectInstallation(installationId: number) {
    setPickedInstallation(installationId);
    setReposLoading(true);
    setError(null);
    try {
      const { repos } = await api.githubInstallRepos(installationId);
      setPendingInstall({ installationId, repos });
      setPicked(repos[0] ? `${repos[0].owner}/${repos[0].repo}` : '');
    } catch (e) {
      if (isNotConfiguredError(e)) {
        setUnconfigured(true);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load repositories');
      }
    } finally {
      setReposLoading(false);
    }
  }

  async function connectPicked() {
    if (!picked || !pendingInstall) return;
    const [owner, repo] = picked.split('/');
    if (!owner || !repo) return;
    setBusy(true);
    setError(null);
    try {
      await api.githubConnect(projectId, pendingInstall.installationId, owner, repo);
      setPendingInstall(null);
      setPickedInstallation(null);
      setFlash({
        tone: 'success',
        text: t('settings.githubConnectedFlash', {
          defaultValue: 'GitHub connected{{repo}}.',
          repo: `: ${owner}/${repo}`,
        }),
      });
      await refresh();
    } catch (e) {
      if (isNotConfiguredError(e)) {
        setUnconfigured(true);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Connect failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api.githubDisconnect(projectId);
      setNotice(t('settings.githubDisconnected', { defaultValue: 'Repository disconnected. Task links are kept as history.' }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveAutomation(next: GitHubAutomation) {
    setBusy(true);
    setError(null);
    try {
      await api.githubAutomation(projectId, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function drain() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.githubDrain(projectId);
      setNotice(
        t('settings.githubDrained', {
          defaultValue: 'Retry queue drained: {{ok}} succeeded, {{fail}} failed, {{pending}} pending.',
          ok: r.succeeded,
          fail: r.failed,
          pending: r.pending,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Drain failed');
    } finally {
      setBusy(false);
    }
  }

  async function startConnect() {    setBusy(true);
    setError(null);
    try {
      // Simpan project asal agar gate global bisa default-kan picker setelah
      // redirect GitHub (pengganti `state` ala OAuth — Setup URL statis).
      // Simpan juga path kembali agar Gate mengantar pulang ke Settings
      // (bukan terdampar di dashboard) + flash sukses.
      try {
        window.localStorage.setItem('devhub:github:pendingProject', projectId);
        savePendingReturn(`${window.location.pathname}${window.location.search}`);
      } catch {
        // storage penuh/diblokir — flow tetap jalan via picker manual.
      }
      const { installUrl } = await api.githubInstallUrl();
      window.location.href = installUrl;
    } catch (e) {
      if (isNotConfiguredError(e)) {
        setUnconfigured(true);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Could not start GitHub connect');
      }
      setBusy(false);
    }
  }

  return (
    <div className="github-stack">
      <h3 className="section-title">
        <GithubLogo size={14} weight="fill" aria-hidden="true" />
        GitHub
      </h3>
      {loading ? (
        <p className="field-helper">{t('settings.loading', { defaultValue: 'Loading…' })}</p>
      ) : error && !status ? (
        <DataErrorState
          error={error}
          onRetry={() => void refresh()}
          retryLabel={t('settings.githubRetry', { defaultValue: 'Try again' })}
        />
      ) : (
        <>
          {notice && (
            <StatusBanner
              tone="success"
              message={notice}
              onDismiss={() => setNotice(null)}
              dismissLabel={t('settings.githubDismiss', { defaultValue: 'Dismiss' })}
              testId="github-notice"
            />
          )}
          {flash ? (
            <StatusBanner
              tone={flash.tone === 'error' ? 'danger' : 'success'}
              title={
                flash.tone === 'error'
                  ? t('settings.githubFailed', { defaultValue: 'Connection failed' })
                  : t('settings.githubFlashConnected', { defaultValue: 'Connected' })
              }
              message={flash.text}
              onDismiss={() => setFlash(null)}
              dismissLabel={t('settings.githubDismiss', { defaultValue: 'Dismiss' })}
              testId="github-flash"
            />
          ) : null}
          {status?.connected ? (
            <div className="github-stack">
              <p className="field-helper">
                {t('settings.githubLinkedTo', {
                  defaultValue: 'Linked to {{repo}}{{account}}.',
                  repo: `${status.owner}/${status.repo}`,
                  account: status.accountLogin ? ` (${status.accountLogin})` : '',
                })}
              </p>
              <GitHubDisclosure />
              {isAdmin && (
                <>
                  <div className="integration-inline-row">
                    <span className="field-helper">
                      {t('settings.githubOnPrOpened', { defaultValue: 'On PR opened' })}
                    </span>
                    <SearchableSelect
                      id="github-auto-opened"
                      label=""
                      ariaLabel={t('settings.githubOnPrOpened', { defaultValue: 'On PR opened' })}
                      value={status.automation?.onPrOpened ?? 'suggest'}
                      allowEmpty={false}
                      searchable={false}
                      options={[
                        { value: 'suggest', label: t('settings.githubModeSuggest', { defaultValue: 'Suggest' }) },
                        { value: 'auto', label: t('settings.githubModeAuto', { defaultValue: 'Auto' }) },
                        { value: 'off', label: t('settings.githubModeOff', { defaultValue: 'Off' }) },
                      ]}
                      onChange={(v) => {
                        if (v && status.automation) void saveAutomation({ ...status.automation, onPrOpened: v as GitHubAutomation['onPrOpened'] });
                      }}
                    />
                    <span className="field-helper">
                      {t('settings.githubOnPrMerged', { defaultValue: 'On PR merged' })}
                    </span>
                    <SearchableSelect
                      id="github-auto-merged"
                      label=""
                      ariaLabel={t('settings.githubOnPrMerged', { defaultValue: 'On PR merged' })}
                      value={status.automation?.onPrMerged ?? 'suggest'}
                      allowEmpty={false}
                      searchable={false}
                      options={[
                        { value: 'suggest', label: t('settings.githubModeSuggest', { defaultValue: 'Suggest' }) },
                        { value: 'auto', label: t('settings.githubModeAuto', { defaultValue: 'Auto' }) },
                        { value: 'off', label: t('settings.githubModeOff', { defaultValue: 'Off' }) },
                      ]}
                      onChange={(v) => {
                        if (v && status.automation) void saveAutomation({ ...status.automation, onPrMerged: v as GitHubAutomation['onPrMerged'] });
                      }}
                    />
                  </div>
                  <div className="integration-actions integration-action-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<ArrowClockwise size={14} aria-hidden="true" />}
                      onClick={() => void drain()}
                      disabled={busy}
                    >
                      {t('settings.githubDrain', { defaultValue: 'Retry failed sync' })}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      leftIcon={<PlugsConnected size={14} aria-hidden="true" />}
                      onClick={() => void disconnect()}
                      disabled={busy}
                    >
                      {t('settings.githubDisconnect', { defaultValue: 'Disconnect' })}
                    </Button>
                  </div>
                </>
              )}
              {!isAdmin && (
                <p className="field-helper">
                  {t('settings.githubAdminOnly', { defaultValue: 'Only owners and admins can change the repository mapping.' })}
                </p>
              )}
            </div>
          ) : (
            <div className="github-stack">
              <p className="field-helper">
                {t('settings.githubDesc', {
                  defaultValue: 'Link pull requests and commits to tasks automatically via DEV keys. One repository per project.',
                })}
              </p>
              <GitHubDisclosure />
              {isAdmin && installations !== null && installations.length === 0 && !pendingInstall && !unconfigured ? (
                <p className="field-helper">
                  {t('settings.githubNoInstallations', {
                    defaultValue: 'No installations yet — install the App first.',
                  })}
                </p>
              ) : null}
              {isAdmin && installations !== null && installations.length > 0 && !pendingInstall && !unconfigured ? (
                <>
                  <p className="field-helper">
                    {t('settings.githubInstalledUnmapped', {
                      defaultValue: 'App installed — pick a repository below to finish connecting.',
                    })}
                  </p>
                  <SearchableSelect
                    id="github-installation-pick"
                    label={t('settings.githubInstallation', { defaultValue: 'GitHub installation' })}
                    ariaLabel={t('settings.githubInstallation', { defaultValue: 'GitHub installation' })}
                    value={pickedInstallation !== null ? String(pickedInstallation) : ''}
                    allowEmpty={false}
                    searchable
                    options={installations.map((inst) => ({
                      value: String(inst.installationId),
                      label: inst.accountLogin
                        ? `${inst.accountLogin}${inst.accountType ? ` (${inst.accountType})` : ''}`
                        : `#${inst.installationId}`,
                    }))}
                    onChange={(v) => {
                      const id = Number(v);
                      if (Number.isInteger(id) && id > 0) void selectInstallation(id);
                    }}
                  />
                  {reposLoading ? (
                    <p className="field-helper">{t('settings.loading', { defaultValue: 'Loading…' })}</p>
                  ) : null}
                  <div className="integration-action-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<GithubLogo size={14} weight="fill" aria-hidden="true" />}
                      onClick={() => void startConnect()}
                      disabled={busy || !canConnect}
                    >
                      {t('settings.githubInstallOther', { defaultValue: 'Install on another GitHub account' })}
                    </Button>
                  </div>
                </>
              ) : null}
              {unconfigured ? (
                <StatusBanner
                  tone="warn"
                  title={t('settings.githubNotConfiguredTitle', { defaultValue: 'GitHub App not configured' })}
                  message={t('settings.githubNotConfiguredDesc', {
                    defaultValue: 'The GitHub App is not set up on this server yet. Ask an admin to configure it, then try again.',
                  })}
                  testId="github-unconfigured"
                />
              ) : null}
              {pendingInstall ? (
                <>
                  <p className="field-helper">
                    {t('settings.githubInstalledUnmapped', {
                      defaultValue: 'App installed — pick a repository below to finish connecting.',
                    })}
                  </p>
                  <SearchableSelect
                    id="github-repo-pick"
                    label={t('settings.githubPickRepo', { defaultValue: 'Repository' })}
                    ariaLabel={t('settings.githubPickRepo', { defaultValue: 'Repository' })}
                    value={picked}
                    allowEmpty={false}
                    searchable
                    options={pendingInstall.repos.map((r) => ({
                      value: `${r.owner}/${r.repo}`,
                      label: r.fullName,
                    }))}
                    onChange={(v) => {
                      if (v) setPicked(v);
                    }}
                  />
                  <div className="integration-action-end">
                    <Button type="button" variant="primary" size="sm" onClick={() => void connectPicked()} disabled={busy || !picked || !isAdmin}>
                      {t('settings.githubConnectRepo', { defaultValue: 'Connect repository' })}
                    </Button>
                  </div>
                </>
              ) : installations !== null && installations.length > 0 && !unconfigured ? null : (
                <div className="settings-action">
                  <div className="settings-action-main">
                    <div className="github-identity">
                      <GithubLogo size={18} weight="fill" aria-hidden="true" />
                      <div className="github-identity-text">
                        <span className="settings-action-title">
                          {t('settings.githubNotConnected', { defaultValue: 'Not connected' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<GithubLogo size={14} weight="fill" aria-hidden="true" />}
                    onClick={() => void startConnect()}
                    disabled={busy || !canConnect || !isAdmin}
                  >
                    {t('settings.githubConnectShort', { defaultValue: 'Connect' })}
                  </Button>
                </div>
              )}
              {canConnect && !isAdmin && (
                <p className="field-helper">
                  {t('settings.githubAdminOnly', { defaultValue: 'Only owners and admins can change the repository mapping.' })}
                </p>
              )}
            </div>
          )}
          {error && status && !unconfigured ? (
            <StatusBanner
              tone="danger"
              message={error}
              onDismiss={() => setError(null)}
              dismissLabel={t('settings.githubDismiss', { defaultValue: 'Dismiss' })}
              testId="github-toast"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
