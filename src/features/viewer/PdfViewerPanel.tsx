import { lazy, memo, Suspense, useMemo, useRef } from 'react';

import { useViewerStore } from '../../stores/viewerStore';
import type { Region, EquipmentTag, ViewKind } from '../../types/domain';
import { realToPdfPoint } from '../../utils/calibration';
import { MarkerOverlay } from './MarkerOverlay';
import { ViewerControls } from './ViewerControls';

const EmbedPdfSurface = lazy(() =>
  import('./EmbedPdfSurface').then((module) => ({ default: module.EmbedPdfSurface })),
);

interface PdfViewerPanelProps {
  view: ViewKind;
  title: string;
  pdfUrl: string | null;
  region: Region | null;
  tag: EquipmentTag | null;
  isVisible: boolean;
}

function PdfViewerPanelComponent({
  view,
  title,
  pdfUrl,
  region,
  tag,
  isVisible,
}: PdfViewerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const viewState = useViewerStore((state) => state.views[view]);
  const marker = useMemo(() => {
    if (!region || !tag) return null;
    return realToPdfPoint(
      tag,
      view,
      view === 'plant' ? region.plantCalibration : region.sideCalibration,
    );
  }, [region, tag, view]);

  const requestFullscreen = () => {
    void panelRef.current?.requestFullscreen?.();
  };

  return (
    <section className={`viewer-panel ${isVisible ? 'flex' : 'hidden md:flex'}`} ref={panelRef}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {pdfUrl ? 'PDF via Firebase Storage' : 'PDF ainda não configurado na região'}
          </p>
        </div>
      </div>

      <div className="viewer-canvas">
        <div
          className="viewer-transform"
          style={{
            transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
          }}
        >
          {pdfUrl ? (
            <Suspense fallback={<div className="viewer-placeholder">Preparando viewer...</div>}>
              <EmbedPdfSurface pdfUrl={pdfUrl} marker={marker} label={tag?.tag ?? null} />
            </Suspense>
          ) : (
            <div className="relative aspect-[2/1] min-w-[720px] rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="absolute inset-0 bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px]" />
              <div className="absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
                {title} - aguardando PDF do Storage
              </div>
              <MarkerOverlay marker={marker} label={tag?.tag ?? null} />
            </div>
          )}
        </div>
      </div>

      <ViewerControls view={view} onFullscreen={requestFullscreen} />
    </section>
  );
}

export const PdfViewerPanel = memo(PdfViewerPanelComponent);
