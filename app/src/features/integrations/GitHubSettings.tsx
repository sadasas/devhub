import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GithubLogo, PlugsConnected } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import type { GitHubAutomation, GitHubInstallationRepo, GitHubStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { SearchableSelect } from '../../components/SearchableSelect';

interface GitHubSettingsProps {
  projectId: string;
  canConnect: boolean;
  isAdmin: boolean;
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

  async function startConnect() {
    setBusy(true);
    setError(null);
    try {
      const { installUrl } = await api.githubInstallUrl();
      window.location.href = installUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start GitHub connect');
      setBusy(false);
    }
  }

  return (
    <div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>
                {t('settings.githubLinkedTo', {
                  defaultValue: 'Linked to {{repo}}{{account}}.',
                  repo: `${status.owner}/${status.repo}`,
                  account: status.accountLogin ? ` (${status.accountLogin})` : '',
                })}
              </p>
              {isAdmin && (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="field-helper" style={{ margin: 0 }}>
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
                    <span className="field-helper" style={{ margin: 0 }}>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void drain()} disabled={busy}>
                      {t('settings.githubDrain', { defaultValue: 'Retry failed sync' })}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void disconnect()} disabled={busy}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>
                {t('settings.githubDesc', {
                  defaultValue: 'Link pull requests and commits to tasks automatically via DEV keys. One repository per project.',
                })}
              </p>
              {pendingInstall ? (
                <>
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
                  <div>
                    <Button type="button" variant="primary" size="sm" onClick={() => void connectPicked()} disabled={busy || !picked || !isAdmin}>
                      {t('settings.githubConnectRepo', { defaultValue: 'Connect repository' })}
                    </Button>
                  </div>
                </>
              ) : (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<PlugsConnected size={14} aria-hidden="true" />}
                    onClick={() => void startConnect()}
                    disabled={busy || !canConnect || !isAdmin}
                  >
                    {t('settings.githubConnect', { defaultValue: 'Connect GitHub' })}
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
