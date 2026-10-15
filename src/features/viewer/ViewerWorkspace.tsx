import type { SelectedTagContext, ViewKind } from '../../types/domain';
import { useViewerStore } from '../../stores/viewerStore';
import { useCallback, useState } from 'react';
import type { PdfHandle } from './EmbedPdfSurface';
import { ShareLocation } from '../tags/ShareLocation';
import { PdfViewerPanel } from './PdfViewerPanel';

interface ViewerWorkspaceProps {
  context: SelectedTagContext | null;
  isLoading: boolean;
}

export function ViewerWorkspace({ context, isLoading }: ViewerWorkspaceProps) {
  const [handles, setHandles] = useState<{ plant: PdfHandle | null; side: PdfHandle | null }>({
    plant: null,
    side: null,
  });
  const plantReady = useCallback(
    (handle: PdfHandle | null) => setHandles((h) => ({ ...h, plant: handle })),
    [],
  );
  const sideReady = useCallback(
    (handle: PdfHandle | null) => setHandles((h) => ({ ...h, side: handle })),
    [],
  );
  const activeMobileView = useViewerStore((state) => state.activeMobileView);
  const setActiveMobileView = useViewerStore((state) => state.setActiveMobileView);

  const setView = (view: ViewKind) => setActiveMobileView(view);

  if (isLoading && !context) {
    return (
      <section className="panel min-h-96 text-sm text-slate-500">Carregando viewers...</section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      {context && (
        <ShareLocation
          key={JSON.stringify([context.tag, context.drawings, context.resolution])}
          context={context}
          handles={handles}
        />
      )}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 md:hidden">
        {(['plant', 'side'] as const).map((view) => (
          <button
            className={`segmented-button ${activeMobileView === view ? 'is-active' : ''}`}
            key={view}
            type="button"
            onClick={() => setView(view)}
          >
            {view === 'plant' ? 'Planta' : 'Lateral'}
          </button>
        ))}
      </div>

      <div className="grid min-h-[62vh] flex-1 grid-cols-1 gap-4 md:min-h-[560px] md:grid-cols-2">
        <PdfViewerPanel
          view="plant"
          title="Planta"
          context={context}
          onReady={plantReady}
          isVisible={activeMobileView === 'plant'}
        />
        <PdfViewerPanel
          view="side"
          title="Lateral"
          context={context}
          onReady={sideReady}
          isVisible={activeMobileView === 'side'}
        />
      </div>
    </section>
  );
}
