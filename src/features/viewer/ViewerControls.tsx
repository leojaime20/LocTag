import type { ViewKind } from '../../types/domain';
import { useViewerStore } from '../../stores/viewerStore';

interface ViewerControlsProps {
  view: ViewKind;
  onFullscreen: () => void;
  resetZoom?: number;
}

export function ViewerControls({ view, onFullscreen, resetZoom = 1 }: ViewerControlsProps) {
  const zoom = useViewerStore((state) => state.views[view].zoom);
  const zoomIn = useViewerStore((state) => state.zoomIn);
  const zoomOut = useViewerStore((state) => state.zoomOut);
  const reset = useViewerStore((state) => state.reset);
  const centerMarker = useViewerStore((state) => state.centerMarker);

  return (
    <div className="viewer-controls">
      <button
        className="icon-button"
        type="button"
        onClick={() => zoomOut(view)}
        aria-label="Zoom -"
      >
        -
      </button>
      <span className="min-w-12 text-center text-xs font-semibold text-slate-500">
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="icon-button"
        type="button"
        onClick={() => zoomIn(view)}
        aria-label="Zoom +"
      >
        +
      </button>
      <button className="control-button" type="button" onClick={() => reset(view, resetZoom)}>
        Reset
      </button>
      <button className="control-button" type="button" onClick={() => centerMarker(view)}>
        Centralizar
      </button>
      <button className="control-button" type="button" onClick={onFullscreen}>
        Tela cheia
      </button>
    </div>
  );
}
