import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GithubLogo } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { clearPendingProject, clearPendingReturn, readPendingProject, readPendingReturn } from '../../lib/github';
import type { GitHubInstallationRepo } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { DataErrorState } from '../../components/DataErrorState';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';

interface PendingSetup {
  installationId: number;
  accountLogin: string | null;
  repos: GitHubInstallationRepo[];
}

/**
 * Gate setup global: menyelesaikan redirect GitHub App (`?github=installed`)
 * di HALAMAN MANA PUN (dashboard, settings, ...). Tanpa ini, mendarat di luar
 * Settings -> Integrations berarti parameter mati dan koneksi tak pernah jadi.
 * Diam total (return null) tanpa params — nol gangguan alur normal.
 */
export function GitHubSetupGate() {
  const { t } = useTranslation('project');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [pending, setPending] = useState<PendingSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedProject, setPickedProject] = useState<string>('');
  const [pickedRepo, setPickedRepo] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isSetupReturn =
    searchParams.get('github') === 'installed' && searchParams.get('installation_id') !== null;

  // Ambil info instalasi + daftar repo sekali saat params terdeteksi
  // (attempt = pemicu ulang saat retry dari DataErrorState).
  useEffect(() => {
    if (!isSetupReturn || pending || loading) return;
    const installationId = Number(searchParams.get('installation_id'));
    if (!Number.isInteger(installationId) || installationId <= 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const setup = await api.githubSetup(installationId, searchParams.get('setup_action') ?? undefined);
        const { repos } = await api.githubInstallRepos(setup.installationId);
        if (cancelled) return;
        setPending({ installationId: setup.installationId, accountLogin: setup.accountLogin, repos });
        setPickedRepo(repos[0] ? `${repos[0].owner}/${repos[0].repo}` : '');
        const saved = readPendingProject();
        setPickedProject(saved ?? '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'GitHub setup failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupReturn, attempt]);

  if (!isSetupReturn) return null;

  const adminProjects = (projects ?? []).filter((p) => p.role === 'owner' || p.role === 'admin');
  const pickedProjectValid = adminProjects.some((p) => p.id === pickedProject);

  function cleanupParams() {
    const next = new URLSearchParams(searchParams);
    next.delete('github');
    next.delete('installation_id');
    next.delete('setup_action');
    setSearchParams(next, { replace: true });
    clearPendingProject();
  }

  /**
   * Antar pulang ke Settings asal (bukan terdampar di dashboard):
   * return path disimpan startConnect; flash sukses ditampilkan Settings
   * via ?github=connected&repo=. Tanpa path tersimpan → tetap di tempat.
   */
  function navigateHome(repo: string) {
    const ret = readPendingReturn();
    clearPendingReturn();
    clearPendingProject();
    if (!ret) return false;
    const sep = ret.includes('?') ? '&' : '?';
    navigate(`${ret}${sep}github=connected&repo=${encodeURIComponent(repo)}`, { replace: true });
    return true;
  }

  function close() {
    setPending(null);
    clearPendingReturn();
    cleanupParams();
  }

  async function connect() {
    if (!pending || !pickedProjectValid || !pickedRepo) return;
    const [owner, repo] = pickedRepo.split('/');
    if (!owner || !repo) return;
    setBusy(true);
    setError(null);
    try {
      await api.githubConnect(pickedProject, pending.installationId, owner, repo);
      const name = adminProjects.find((p) => p.id === pickedProject)?.name ?? '';
      setDone(
        t('settings.githubGateDone', {
          defaultValue: 'Connected {{repo}} to project "{{project}}".',
          repo: pickedRepo,
          project: name,
        }),
      );
      // Pulang ke Settings asal bila diketahui (flash sukses di sana).
      if (navigateHome(pickedRepo)) return;
      cleanupParams();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <GithubLogo size={16} weight="fill" aria-hidden="true" />
          {t('settings.githubGateTitle', { defaultValue: 'Finish GitHub connection' })}
        </span>
      }
      footer={
        <>
          <Button type="button" variant="ghost" size="md" onClick={close}>
            {t('settings.githubGateLater', { defaultValue: 'Later' })}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void connect()}
            disabled={busy || loading || !pickedProjectValid || !pickedRepo}
          >
            {t('settings.githubConnectRepo', { defaultValue: 'Connect repository' })}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="field-helper">{t('settings.loading', { defaultValue: 'Loading…' })}</p>
      ) : error && !pending ? (
        <DataErrorState
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
          retryLabel={t('settings.githubRetry', { defaultValue: 'Try again' })}
        />
      ) : done ? (
        <p className="field-helper" role="status">
          {done}
        </p>
      ) : pending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="field-helper" style={{ margin: 0 }}>
            {t('settings.githubGateDesc', {
              defaultValue: 'GitHub App installed{{account}}. Pick a project and repository to finish.',
              account: pending.accountLogin ? ` on "${pending.accountLogin}"` : '',
            })}
          </p>
          <SearchableSelect
            id="github-gate-project"
            label={t('settings.githubGateProject', { defaultValue: 'DevHub project' })}
            value={pickedProjectValid ? pickedProject : ''}
            allowEmpty={false}
            searchable
            options={adminProjects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(v) => {
              if (v) setPickedProject(v);
            }}
          />
          <SearchableSelect
            id="github-gate-repo"
            label={t('settings.githubPickRepo', { defaultValue: 'Repository' })}
            value={pickedRepo}
            allowEmpty={false}
            searchable
            options={pending.repos.map((r) => ({ value: `${r.owner}/${r.repo}`, label: r.fullName }))}
            onChange={(v) => {
              if (v) setPickedRepo(v);
            }}
          />
          {error && <InlineError>{error}</InlineError>}
          {adminProjects.length === 0 && (
            <p className="field-helper">
              {t('settings.githubAdminOnly', { defaultValue: 'Only owners and admins can change the repository mapping.' })}
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
