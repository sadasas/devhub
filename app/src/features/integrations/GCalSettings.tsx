import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarBlank, GoogleLogo, LinkBreak } from '@phosphor-icons/react';
import { api, type GCalStatus } from '../../lib/api';
import {
  DOCS_PRIVACY_URL,
  DOCS_TERMS_URL,
  GOOGLE_ACCOUNT_PERMISSIONS_URL,
  GOOGLE_API_USER_DATA_POLICY_URL,
} from '../../lib/docs-urls';
import { getErrorMessage } from '../../lib/errors';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DataErrorState } from '../../components/DataErrorState';
import { GCalBanner } from './GCalBanner';

interface GCalSettingsProps {
  projectId: string;
  canEdit: boolean;
  /** Render tanpa panel luar — untuk disematkan di panel lain (mis. Project Settings). */
  bare?: boolean;
}

/**
 * Panel integrasi Google Calendar (T4).
 * Reuse pola ProfilePage settings-action rows + ConfirmDeleteDialog + save-toast banner.
 * Gate canEdit: viewer/public tidak dirender (return null).
 */
export function GCalSettings({ projectId, canEdit, bare = false }: GCalSettingsProps) {
  const { t } = useTranslation('extras');
  const [status, setStatus] = useState<GCalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [reconnectBusy, setReconnectBusy] = useState(false);
  // Flash dari redirect callback OAuth (?gcal=connected / ?gcal_error=CODE).
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorRaw(null);
    try {
      const next = await api.gcalStatus(projectId);
      setStatus(next);
    } catch (err) {
      setLoadErrorRaw(err);
      setLoadError(
        getErrorMessage(err, t('gcal.loadError', { defaultValue: 'Failed to load calendar status.' })),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (!canEdit) return;
    // Konsumsi flag redirect callback sekali, lalu bersihkan URL.
    try {
      const url = new URL(window.location.href);
      const ok = url.searchParams.get('gcal');
      const err = url.searchParams.get('gcal_error');
      if (ok === 'connected' || err) {
        if (ok === 'connected') {
          setFlash({
            tone: 'success',
            text: t('gcal.connectedFlash', { defaultValue: 'Google Calendar connected.' }),
          });
        } else {
          const code = err ?? '';
          const key =
            code === 'INVALID_STATE'
              ? 'gcal.errorInvalidState'
              : code === 'OAUTH_EXCHANGE_FAILED'
                ? 'gcal.errorExchange'
                : code === 'OAUTH_NO_REFRESH'
                  ? 'gcal.errorNoRefresh'
                  : code === 'OAUTH_PROVIDER_ERROR'
                    ? 'gcal.errorProvider'
                    : code === 'UNAUTHORIZED'
                      ? 'gcal.errorSession'
                      : null;
          setFlash({
            tone: 'error',
            text: key
              ? (t(key, { defaultValue: '' }) || code)
              : t('gcal.errorUnknown', { defaultValue: 'Google Calendar connection failed ({{code}}).', code }),
          });
        }
        url.searchParams.delete('gcal');
        url.searchParams.delete('gcal_error');
        window.history.replaceState(null, '', url.toString());
      }
    } catch {
      // URL tak terparse — abaikan, status tetap di-fetch di bawah.
    }
    void fetchStatus();
  }, [canEdit, fetchStatus, t]);

  if (!canEdit) return null;

  const connected = status?.connected === true;
  const expired = status?.expired === true;
  const syncEnabled = status?.syncEnabled === true;

  const handleToggle = async (next: boolean) => {
    setSyncBusy(true);
    setActionError(null);
    try {
      await api.gcalSetSync(projectId, next);
      setStatus((prev) => (prev ? { ...prev, syncEnabled: next } : prev));
    } catch (err) {
      setActionError(
        getErrorMessage(err, t('gcal.toggleError', { defaultValue: 'Failed to update sync setting.' })),
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectBusy(true);
    setDisconnectError(null);
    try {
      await api.gcalDisconnect(projectId);
      setStatus((prev) =>
        prev ? { ...prev, connected: false, expired: false, syncEnabled: false } : prev,
      );
      setConfirmOpen(false);
    } catch (err) {
      setDisconnectError(
        getErrorMessage(err, t('gcal.disconnectError', { defaultValue: 'Failed to disconnect.' })),
      );
    } finally {
      setDisconnectBusy(false);
    }
  };

  const handleReconnect = () => {
    setReconnectBusy(true);
    window.location.assign(api.gcalConnectUrl(projectId, window.location.href));
  };

  const content = (
    <>
      <h3 id="gcal-heading" className="section-title">
        <CalendarBlank size={14} weight="duotone" aria-hidden="true" />
        {t('gcal.title', { defaultValue: 'Google Calendar' })}
      </h3>
      <div className="gcal-stack">
        <p className="field-helper">
          {t('gcal.helper', {
            defaultValue: 'Sync tasks with due dates to Google Calendar. Reconnect when the connection expires.',
          })}
        </p>
        <div className="integration-disclosure">
          <p className="field-helper">
            {t('gcal.why', {
              defaultValue:
                'Tasks with start or due dates become all-day events in a “DevHub - <project>” calendar; edits and deletions sync automatically.',
            })}
          </p>
          <p className="field-helper">
            {t('gcal.features2', {
              defaultValue:
                'Sync can be turned off per project without disconnecting; reconnect when the token expires.',
            })}
          </p>
          <p className="field-helper">
            {t('gcal.access', {
              defaultValue:
                'DevHub can only create and manage calendars and events it created — it cannot read your other calendars. Connection tokens are stored encrypted.',
            })}
          </p>
          <p className="field-helper">
            {t('gcal.legalPrefix', { defaultValue: 'Details:' })}{' '}
            <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">
              {t('gcal.privacyLink', { defaultValue: 'Privacy Policy' })}
            </a>
            {' · '}
            <a href={DOCS_TERMS_URL} target="_blank" rel="noopener">
              {t('gcal.termsLink', { defaultValue: 'Terms' })}
            </a>
            {' · '}
            <a href={GOOGLE_ACCOUNT_PERMISSIONS_URL} target="_blank" rel="noopener">
              {t('gcal.revokeLink', { defaultValue: 'Google account permissions' })}
            </a>
            {' · '}
            <a href={GOOGLE_API_USER_DATA_POLICY_URL} target="_blank" rel="noopener">
              {t('gcal.googleLink', { defaultValue: "Google's API policies" })}
            </a>
            .
          </p>
        </div>
        {loading ? (
          <p className="field-helper" role="status">
            {t('gcal.loading', { defaultValue: 'Loading calendar status…' })}
          </p>
        ) : loadError ? (
          <DataErrorState
            error={loadErrorRaw ?? loadError}
            onRetry={() => void fetchStatus()}
            retryLabel={t('gcal.retry', { defaultValue: 'Try again' })}
          />
        ) : (
          <>
            <div className="settings-row-group">
              <div className="settings-action">
                <div className="settings-action-main">
                  <div className="gcal-identity">
                    <GoogleLogo size={18} weight="bold" aria-hidden="true" />
                    <div className="gcal-identity-text">
                      <span className="settings-action-title">
                        {connected
                          ? (status?.email ??
                            t('gcal.connected', { defaultValue: 'Connected' }))
                          : t('gcal.disconnected', { defaultValue: 'Not connected' })}
                      </span>
                      {connected && (
                        <span className="settings-action-desc">
                          {status?.lastSyncAt
                            ? t('gcal.lastSync', {
                                defaultValue: 'Last synced {{date}}',
                                date: status.lastSyncAt,
                              })
                            : t('gcal.neverSynced', { defaultValue: 'Never synced' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {connected ? (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<LinkBreak size={14} aria-hidden="true" />}
                    onClick={() => {
                      setDisconnectError(null);
                      setConfirmOpen(true);
                    }}
                  >
                    {t('gcal.disconnect', { defaultValue: 'Disconnect' })}
                  </Button>
                ) : (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={api.gcalConnectUrl(projectId, window.location.href)}
                  >
                    <GoogleLogo size={14} weight="bold" aria-hidden="true" />
                    {t('gcal.connect', { defaultValue: 'Connect' })}
                  </a>
                )}
              </div>
              {connected ? (
                <div className="settings-action settings-action--inline">
                  <div className="settings-action-main">
                    <span className="settings-action-title">
                      {t('gcal.syncTitle', { defaultValue: 'Calendar sync' })}
                    </span>
                    <span className="settings-action-desc">
                      {syncBusy
                        ? t('gcal.syncSaving', { defaultValue: 'Saving…' })
                        : syncEnabled
                          ? t('gcal.syncOn', { defaultValue: 'Sync on' })
                          : expired
                            ? t('gcal.syncPaused', { defaultValue: 'Sync paused' })
                            : t('gcal.syncOff', { defaultValue: 'Sync off' })}
                    </span>
                  </div>
                  <label className="consent-switch gcal-switch">
                    <input
                      type="checkbox"
                      checked={syncEnabled}
                      disabled={syncBusy}
                      aria-busy={syncBusy || undefined}
                      onChange={(e) => void handleToggle(e.target.checked)}
                      aria-label={t('gcal.syncTitle', { defaultValue: 'Calendar sync' })}
                    />
                    <span
                      aria-hidden="true"
                      className={
                        syncEnabled
                          ? 'consent-switch-ui consent-switch-ui--on'
                          : 'consent-switch-ui'
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>
            {connected && expired ? (
              <GCalBanner email={status?.email} onReconnect={handleReconnect} busy={reconnectBusy} />
            ) : null}
            {flash ? (
              <div
                className="save-toast save-banner"
                role={flash.tone === 'error' ? 'alert' : 'status'}
                data-testid="gcal-flash"
              >
                <Badge tone={flash.tone === 'error' ? 'danger' : 'success'} dot>
                  {flash.tone === 'error'
                    ? t('gcal.failed', { defaultValue: 'Connection failed' })
                    : t('gcal.connected', { defaultValue: 'Connected' })}
                </Badge>
                <div className="save-toast-body">
                  <span>{flash.text}</span>
                </div>
                <Button variant="ghost" size="sm" className="save-toast-close" onClick={() => setFlash(null)}>
                  {t('gcal.dismiss', { defaultValue: 'Dismiss' })}
                </Button>
              </div>
            ) : null}
            {actionError ? (
              <div className="save-toast save-banner" role="alert" data-testid="gcal-toast">
                <div className="save-toast-body">
                  <span>{actionError}</span>
                </div>
                <Button variant="ghost" size="sm" className="save-toast-close" onClick={() => setActionError(null)}>
                  {t('gcal.dismiss', { defaultValue: 'Dismiss' })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        title={t('gcal.disconnectTitle', { defaultValue: 'Disconnect Google Calendar?' })}
        description={t('gcal.disconnectDesc', {
          defaultValue:
            'DevHub will stop syncing tasks to Google Calendar. Existing events stay in your calendar.',
        })}
        confirmLabel={t('gcal.disconnect', { defaultValue: 'Disconnect' })}
        busy={disconnectBusy}
        error={disconnectError}
        onConfirm={() => void handleDisconnect()}
        onClose={() => {
          if (!disconnectBusy) setConfirmOpen(false);
        }}
      />
    </>
  );
  if (bare) return content;
  return (
    <section className="profile-panel" aria-labelledby="gcal-heading">
      {content}
    </section>
  );
}
