import { Check, Copy } from '@phosphor-icons/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import type { ApiEndpoint } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ApiMethodChip } from './ApiMethodChip';

export function responseTone(status: number): 'success' | 'warn' | 'danger' | 'info' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'warn';
  if (status >= 400) return 'danger';
  return 'info';
}

export function EndpointDocs({ endpoint }: { endpoint: ApiEndpoint }) {
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="api-docs-endpoint">
      <div className="api-docs-endpoint-head">
        <div className="api-workbench-method">
          <ApiMethodChip method={endpoint.method} />
          <code className="api-path-view">{endpoint.path}</code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="btn-icon"
          aria-label="Copy path"
          title="Copy path"
          leftIcon={
            copied ? (
              <Check size={13} weight="bold" aria-hidden="true" />
            ) : (
              <Copy size={13} aria-hidden="true" />
            )
          }
          onClick={() => void copy(endpoint.path)}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <h2 className="preview-title">{endpoint.name}</h2>
      {endpoint.description && (
        <div className="preview-block">
          <div className="preview-label">Description</div>
          <p className="preview-body">{endpoint.description}</p>
        </div>
      )}
      {endpoint.params.length > 0 && (
        <div className="preview-block">
          <div className="preview-label">Parameters</div>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>In</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((p) => (
                <tr key={`${p.in}-${p.name}`}>
                  <td className="preview-mono">{p.name}</td>
                  <td className="preview-mono">{p.in}</td>
                  <td>{p.required ? 'yes' : ''}</td>
                  <td>{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {endpoint.headers.length > 0 && (
        <div className="preview-block">
          <div className="preview-label">Headers</div>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.headers.map((h) => (
                <tr key={h.key || h.description}>
                  <td className="preview-mono">{h.key}</td>
                  <td className="preview-mono">{h.value}</td>
                  <td>{h.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {endpoint.body && (
        <div className="preview-block">
          <div className="preview-label">Request body</div>
          <pre className="preview-pre">{endpoint.body}</pre>
        </div>
      )}
      {endpoint.responses.length > 0 && (
        <div className="preview-block">
          <div className="preview-label">Responses</div>
          <div className="preview-resps">
            {endpoint.responses.map((r) => (
              <div key={r.status} className="preview-resp">
                <div className="preview-resp-head">
                  <Badge tone={responseTone(r.status)}>{r.status}</Badge>
                  {r.contentType && <span className="preview-mime">{r.contentType}</span>}
                  {r.description && <span className="preview-body">{r.description}</span>}
                </div>
                {r.body && <pre className="preview-pre">{r.body}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
