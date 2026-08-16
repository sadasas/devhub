import { useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import type { State } from '../../lib/types';
import { WhiteboardCard } from '../whiteboard/WhiteboardCard';
import { WhiteboardCanvas } from '../whiteboard/WhiteboardCanvas';
import type { WhiteboardHistory } from '../whiteboard/useWhiteboardHistory';

const NOOP_HISTORY: WhiteboardHistory = {
  canUndo: false,
  canRedo: false,
  record: () => {},
  undo: () => {},
  redo: () => {},
};

export function PublicWhiteboards({ state, projectId }: { state: State; projectId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const board = selectedId ? state.whiteboards.find((b) => b.id === selectedId) : undefined;

  if (board) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h3 className="page-title">{board.name}</h3>
            {board.description && <p className="page-subtitle">{board.description}</p>}
          </div>
          <div className="project-actions">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label="Back to boards">
              <ArrowLeft size={14} aria-hidden="true" />
              Boards
            </Button>
          </div>
        </div>
        <WhiteboardCanvas
          board={board}
          tool="select"
          history={NOOP_HISTORY}
          readOnly
          readOnlyState={state}
          readOnlyProjectId={projectId}
        />
      </div>
    );
  }

  if (state.whiteboards.length === 0) {
    return <p className="about-section-body about-section-body-empty">No whiteboards yet.</p>;
  }

  return (
    <div className="project-grid">
      {state.whiteboards.map((b) => (
        <WhiteboardCard key={b.id} board={b} canEdit={false} onOpen={() => setSelectedId(b.id)} />
      ))}
    </div>
  );
}