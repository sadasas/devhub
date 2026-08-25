import { Plus, UploadSimple, MagnifyingGlass, Users } from '@phosphor-icons/react';
import { Button } from '../../components/Button';

export function WelcomeEmptyNoTeam({ onCreateTeam }: { onCreateTeam: () => void }) {
  return (
    <div className="welcome-empty-strip" role="status" aria-live="polite">
      <span className="welcome-empty-icon" aria-hidden="true">
        <Users size={20} weight="duotone" />
      </span>
      <h3 className="welcome-empty-title">Create a team first</h3>
      <p className="welcome-empty-desc">DevHub organizes projects inside teams — create a team from the sidebar, then come back to add your first project.</p>
      <div className="welcome-empty-actions">
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onCreateTeam}>
          Create team
        </Button>
      </div>
    </div>
  );
}

export function WelcomeEmptyNoProject({
  teamName,
  onCreate,
  onImport,
}: {
  teamName?: string;
  onCreate: () => void;
  onImport?: () => void;
}) {
  return (
    <div className="welcome-empty-strip" role="status">
      <span className="welcome-empty-icon" aria-hidden="true">
        <Plus size={20} weight="duotone" />
      </span>
      <h3 className="welcome-empty-title">{teamName ? `No projects in ${teamName}` : 'No projects yet'}</h3>
      <p className="welcome-empty-desc">Mulai technical memory pertama. Create a project to track tasks, issues, stack and more — or import from JSON.</p>
      <div className="welcome-empty-actions">
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onCreate}>
          Create project
        </Button>
        {onImport && (
          <Button variant="ghost" leftIcon={<UploadSimple size={14} aria-hidden="true" />} onClick={onImport}>
            Import
          </Button>
        )}
      </div>
    </div>
  );
}

export function WelcomeEmptyNoResult({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="welcome-empty-strip welcome-empty-strip-muted" role="status">
      <span className="welcome-empty-icon" aria-hidden="true">
        <MagnifyingGlass size={20} aria-hidden="true" />
      </span>
      <h3 className="welcome-empty-title">No results for “{query}”</h3>
      <p className="welcome-empty-desc">Try a different keyword or clear the filter to see all projects.</p>
      <div className="welcome-empty-actions">
        <Button variant="ghost" onClick={onClear}>
          Clear filter
        </Button>
      </div>
    </div>
  );
}
