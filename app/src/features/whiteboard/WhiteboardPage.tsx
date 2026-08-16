import { useSearchParams } from 'react-router';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { WhiteboardList } from './WhiteboardList';
import { WhiteboardEditorShell } from './WhiteboardEditorShell';

export function WhiteboardPage() {
  const { state, loading } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useEntityOpenParam(searchParams, setSearchParams);
  useEntityDeepLink('whiteboards', setOpenId);

  if (loading || !state) {
    return <WhiteboardList loading />;
  }

  if (openId) {
    const board = state.whiteboards.find((b) => b.id === openId);
    if (board) {
      return (
        <WhiteboardEditorShell
          board={board}
          onBack={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('view');
            next.delete('id');
            setSearchParams(next);
          }}
        />
      );
    }
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('id');
    setSearchParams(next);
  }

  return <WhiteboardList onOpen={setOpenId} />;
}

interface OpenParamHook {
  (params: URLSearchParams, set: (p: URLSearchParams) => void): [string | null, (id: string) => void];
}

const useEntityOpenParam: OpenParamHook = (params, set) => {
  const id = params.get('id');
  const open = (boardId: string) => {
    const next = new URLSearchParams(params);
    next.set('view', 'board');
    next.set('id', boardId);
    set(next);
  };
  return [id, open];
};