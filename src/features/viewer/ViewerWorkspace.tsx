import type { Region, SelectedTagContext, ViewKind } from '../../types/domain';
import { useViewerStore } from '../../stores/viewerStore';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import type { SpatialCamera } from '../spatial/camera';
import type { PdfHandle } from './EmbedPdfSurface';
import { ShareLocation } from '../tags/ShareLocation';
import { PdfViewerPanel } from './PdfViewerPanel';
const TagRegionViewer = lazy(() => import('./TagRegionViewer'));
const emptyRegions: Region[] = [];

interface ViewerWorkspaceProps {
  context: SelectedTagContext | null;
  isLoading: boolean;
  regions?: Region[];
  on3DChange?: (value: boolean) => void;
}

export function ViewerWorkspace({
  context,
  isLoading,
  regions = emptyRegions,
  on3DChange,
}: ViewerWorkspaceProps) {
  const [show3d, setShow3d] = useState(false);
  const savedCameraRef = useRef<SpatialCamera | null>(null);
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

  const setMode3D = (value: boolean) => {
    setShow3d(value);
    on3DChange?.(value);
  };
  const setView = (view: ViewKind) => {
    setMode3D(false);
    setActiveMobileView(view);
  };

  if (isLoading && !context) {
    return (
      <section className="panel min-h-96 text-sm text-slate-500">Carregando viewers...</section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      {context && !show3d && !context.drawingsLoading && !context.drawingsError && (
        <ShareLocation
          key={JSON.stringify([context.tag, context.drawings, context.resolution])}
          context={context}
          handles={handles}
        />
      )}
      <nav aria-label="Visualizações no celular" className="query-view-tabs md:hidden">
        {(['plant', 'side'] as const).map((view) => (
          <button
            className={`segmented-button ${!show3d && activeMobileView === view ? 'is-active' : ''}`}
            aria-pressed={!show3d && activeMobileView === view}
            key={view}
            type="button"
            onClick={() => setView(view)}
          >
            {view === 'plant' ? 'Planta' : 'Lateral'}
          </button>
        ))}
        <button
          className={`segmented-button ${show3d ? 'is-active' : ''}`}
          aria-pressed={show3d}
          onClick={() => setMode3D(true)}
        >
          3D
        </button>
      </nav>
      <nav aria-label="Visualizações no computador" className="hidden md:flex gap-2">
        <button
          className={show3d ? 'button-secondary' : 'button-primary'}
          aria-pressed={!show3d}
          onClick={() => setMode3D(false)}
        >
          Desenhos
        </button>
        <button
          className={show3d ? 'button-primary' : 'button-secondary'}
          aria-pressed={show3d}
          onClick={() => setMode3D(true)}
        >
          3D
        </button>
      </nav>

      <div
        className={
          show3d
            ? 'hidden'
            : 'grid min-h-[62vh] flex-1 grid-cols-1 gap-4 md:min-h-[560px] md:grid-cols-2'
        }
      >
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
      {show3d &&
        (context ? (
          <Suspense
            fallback={
              <div className="panel" role="status">
                Preparando visualização 3D…
              </div>
            }
          >
            <TagRegionViewer
              key={JSON.stringify([context.tag.id, context.tag.x, context.tag.y, context.tag.z])}
              context={context}
              regions={regions}
              savedCameraRef={savedCameraRef}
            />
          </Suspense>
        ) : (
          <p className="panel" role="status">
            Selecione uma TAG para visualizar sua posição em 3D.
          </p>
        ))}
    </section>
  );
}
