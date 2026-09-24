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
import type { GitHubAutomation, GitHubInstallationRepo, GitHubStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { SearchableSelect } from '../../components/SearchableSelect';

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.githubStatus(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GitHub status');
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'GitHub setup failed');
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

  async function connectPicked() {
    if (!picked || !pendingInstall) return;
    const [owner, repo] = picked.split('/');
    if (!owner || !repo) return;
    setBusy(true);
    setError(null);
    try {
      await api.githubConnect(projectId, pendingInstall.installationId, owner, repo);
      setPendingInstall(null);
      setNotice(t('settings.githubConnected', { defaultValue: 'Repository connected.' }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
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
      try {
        window.localStorage.setItem('devhub:github:pendingProject', projectId);
      } catch {
        // storage penuh/diblokir — flow tetap jalan via picker manual.
      }
      const { installUrl } = await api.githubInstallUrl();
      window.location.href = installUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start GitHub connect');
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
        <p className="field-helper" role="alert">
          {error}
        </p>
      ) : (
        <>
          {notice && (
            <p className="field-helper" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="field-helper" role="alert">
              {error}
            </p>
          )}
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
              ) : (
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
        </>
      )}
    </div>
  );
}
