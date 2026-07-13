import type { SelectedTagContext, ViewKind } from '../../types/domain';
import { useViewerStore } from '../../stores/viewerStore';
import { PdfViewerPanel } from './PdfViewerPanel';

interface ViewerWorkspaceProps {
  context: SelectedTagContext | null;
  isLoading: boolean;
}

export function ViewerWorkspace({ context, isLoading }: ViewerWorkspaceProps) {
  const activeMobileView = useViewerStore((state) => state.activeMobileView);
  const setActiveMobileView = useViewerStore((state) => state.setActiveMobileView);

  const setView = (view: ViewKind) => setActiveMobileView(view);

  if (isLoading) {
    return <section className="panel min-h-96 text-sm text-slate-500">Carregando viewers...</section>;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
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

      <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <PdfViewerPanel
          view="plant"
          title="Planta"
          pdfUrl={context?.plantPdfUrl ?? null}
          region={context?.region ?? null}
          tag={context?.tag ?? null}
          isVisible={activeMobileView === 'plant'}
        />
        <PdfViewerPanel
          view="side"
          title="Lateral"
          pdfUrl={context?.sidePdfUrl ?? null}
          region={context?.region ?? null}
          tag={context?.tag ?? null}
          isVisible={activeMobileView === 'side'}
        />
      </div>
    </section>
  );
}
