import { usePdfEngine } from '../../hooks/usePdfEngine';
import type { PdfDocumentObject, PdfEngine, PdfPageObject } from '@embedpdf/models';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalibrationPoint, ViewKind } from '../../types/domain';
import type { PdfPoint } from '../../utils/calibration';
import {
  pageToScreen,
  pointInPage,
  screenToPage,
  viewportRect,
  type Camera,
  type PageRect,
} from '../../utils/viewport';
import { useViewerStore } from '../../stores/viewerStore';
import { ViewerControls } from './ViewerControls';

export interface PdfHandle {
  pdfUrl: string;
  page: PdfPageObject;
  render: (rect: PageRect, width: number) => Promise<Blob>;
}
interface Props {
  pdfUrl: string;
  pageIndex?: number;
  view?: ViewKind;
  marker: PdfPoint | null;
  label: string | null;
  initialZoom?: number;
  points?: CalibrationPoint[];
  residuals?: number[];
  tolerance?: number;
  onPick?: (point: PdfPoint) => void;
  onReady?: (handle: PdfHandle | null) => void;
}
interface OpenDocument {
  engine: PdfEngine;
  document: PdfDocumentObject;
  page: PdfPageObject;
}
const noPoints: CalibrationPoint[] = [];
function Surface({
  pdfUrl,
  pageIndex = 0,
  view,
  marker,
  label,
  initialZoom = 4,
  points = noPoints,
  residuals = [],
  tolerance = 3,
  onPick,
  onReady,
  onRetry,
}: Props & { onRetry: () => void }) {
  const { engine, error: engineError } = usePdfEngine();
  const [opened, setOpened] = useState<OpenDocument | null>(null);
  const [error, setError] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [detail, setDetail] = useState<{ url: string; rect: PageRect } | null>(null);
  const [renderError, setRenderError] = useState('');
  const [miniOpen, setMiniOpen] = useState(true);
  const [localCamera, setLocalCamera] = useState<Camera>({ zoom: 1, centerX: 0, centerY: 0 });
  const stored = useViewerStore((state) => state.views[view ?? 'plant']);
  const storeCamera = useViewerStore((state) => state.setCamera);
  const camera = view ? stored : localCamera;
  const setCamera = useCallback(
    (next: Camera) => (view ? storeCamera(view, next) : setLocalCamera(next)),
    [storeCamera, view],
  );
  const viewport = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 480 });
  const drag = useRef<{ x: number; y: number; rect: PageRect; moved: boolean } | null>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!engine) return;
    let disposed = false;
    let document: PdfDocumentObject | null = null;
    const task = engine.openDocumentUrl(
      { id: crypto.randomUUID(), url: pdfUrl },
      { mode: 'full-fetch', normalizeRotation: false },
    );
    const timeout = window.setTimeout(() => {
      if (!disposed)
        setError('O PDF está demorando a carregar. Verifique a conexão e tente novamente.');
    }, 180_000);
    task
      .toPromise()
      .then((result) => {
        clearTimeout(timeout);
        document = result;
        if (disposed) {
          void engine
            .closeDocument(result)
            .toPromise()
            .catch(() => {});
          return;
        }
        const page = result.pages[pageIndex];
        if (!page) throw new Error('Página não encontrada no PDF.');
        setOpened({ engine, document: result, page });
        setError('');
      })
      .catch(() => {
        clearTimeout(timeout);
        if (!disposed)
          setError('Não foi possível abrir o PDF. Confira o arquivo, a página e as permissões.');
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      readyRef.current?.(null);
      if (document)
        void engine
          .closeDocument(document)
          .toPromise()
          .catch(() => {});
    };
  }, [engine, pdfUrl, pageIndex]);
  const page = opened?.page;
  const handle = useMemo<PdfHandle | null>(
    () =>
      opened
        ? {
            pdfUrl,
            page: opened.page,
            render: (rect, width) =>
              opened.engine
                .renderPageRect(
                  opened.document,
                  opened.page,
                  {
                    origin: { x: rect.x, y: rect.y },
                    size: { width: rect.width, height: rect.height },
                  },
                  {
                    scaleFactor: width / rect.width,
                    dpr: 1,
                    rotation: 0,
                    imageType: 'image/png',
                    withAnnotations: true,
                  },
                )
                .toPromise(),
          }
        : null,
    [opened, pdfUrl],
  );
  useEffect(() => {
    readyRef.current?.(handle);
    return () => readyRef.current?.(null);
  }, [handle]);
  useEffect(() => {
    if (!page) return;
    const valid = marker && pointInPage(marker, page.size);
    // Synchronize navigation with the external selected equipment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCamera({
      zoom: valid ? initialZoom : 1,
      centerX: valid ? marker.x : page.size.width / 2,
      centerY: valid ? marker.y : page.size.height / 2,
    });
    // Synchronize the camera when the selected TAG changes, never reopen its PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, marker?.x, marker?.y, label, initialZoom, setCamera]);
  useEffect(() => {
    if (!handle || !page) return;
    let disposed = false;
    let url = '';
    handle
      .render(
        { x: 0, y: 0, ...page.size },
        Math.min(360, (360 * page.size.width) / page.size.height),
      )
      .then((blob) => {
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setThumbnail(url);
      })
      .catch(() => {
        if (!disposed) setRenderError('Falha ao gerar miniatura. Tente novamente.');
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [handle, page]);
  const rect = useMemo(
    () => (page ? viewportRect(page.size, size, camera) : null),
    [page, size, camera],
  );
  useEffect(() => {
    if (!handle || !rect) return;
    let disposed = false;
    let url = '';
    const timer = window.setTimeout(() => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(6_000_000 / (size.width * size.height)),
      );
      handle
        .render(rect, size.width * dpr)
        .then((blob) => {
          if (disposed) return;
          url = URL.createObjectURL(blob);
          setDetail({ url, rect });
          setRenderError('');
        })
        .catch(() => {
          if (!disposed) setRenderError('Falha ao renderizar o desenho. Tente novamente.');
        });
    }, 90);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [handle, rect, size]);
  const zoom = (value: number) =>
    setCamera({
      ...camera,
      centerX: rect ? rect.x + rect.width / 2 : camera.centerX,
      centerY: rect ? rect.y + rect.height / 2 : camera.centerY,
      zoom: Math.min(32, Math.max(1, value)),
    });
  const rectStyle = (area: PageRect) =>
    rect
      ? {
          left: ((area.x - rect.x) * size.width) / rect.width,
          top: ((area.y - rect.y) * size.height) / rect.height,
          width: (area.width * size.width) / rect.width,
          height: (area.height * size.height) / rect.height,
        }
      : {};
  const navigateMini = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!page) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCamera({
      ...camera,
      centerX: ((event.clientX - bounds.left) / bounds.width) * page.size.width,
      centerY: ((event.clientY - bounds.top) / bounds.height) * page.size.height,
    });
  };
  const validMarker = marker && page && pointInPage(marker, page.size) ? marker : null;
  return (
    <div ref={root} className="pdf-surface">
      <div
        ref={viewport}
        className={`pdf-viewport ${onPick ? 'is-picking' : ''}`}
        tabIndex={0}
        aria-label="Desenho PDF: arraste para navegar, use os controles para ampliar"
        onKeyDown={(event) => {
          if (
            !rect ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(event.key)
          )
            return;
          event.preventDefault();
          if (event.key === '+' || event.key === '-')
            zoom(camera.zoom * (event.key === '+' ? 1.4 : 1 / 1.4));
          else
            setCamera({
              ...camera,
              centerX:
                rect.x +
                rect.width / 2 +
                ((event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) *
                  rect.width) /
                  5,
              centerY:
                rect.y +
                rect.height / 2 +
                ((event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0) * rect.height) /
                  5,
            });
        }}
        onPointerDown={(event) => {
          if (!rect) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, rect, moved: false };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) > 4) start.moved = true;
          if (start.moved)
            setCamera({
              ...camera,
              centerX: start.rect.x + start.rect.width / 2 - (dx * start.rect.width) / size.width,
              centerY:
                start.rect.y + start.rect.height / 2 - (dy * start.rect.height) / size.height,
            });
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          drag.current = null;
          if (!start || start.moved || !onPick || !rect || !page) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const point = screenToPage(
            { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            rect,
            size,
          );
          if (pointInPage(point, page.size)) onPick(point);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {!opened && (
          <div className="viewer-placeholder">
            {error || engineError?.message || 'Carregando PDF…'}
          </div>
        )}
        {page && rect && (
          <>
            {thumbnail && (
              <img
                draggable={false}
                alt=""
                className="pdf-layer"
                src={thumbnail}
                style={rectStyle({ x: 0, y: 0, ...page.size })}
              />
            )}
            {detail && (
              <img
                draggable={false}
                alt="Desenho técnico"
                className="pdf-layer"
                src={detail.url}
                style={rectStyle(detail.rect)}
              />
            )}
            <svg className="pdf-overlay" width={size.width} height={size.height}>
              {validMarker &&
                (() => {
                  const p = pageToScreen(validMarker, rect, size);
                  return (
                    <g transform={`translate(${p.x} ${p.y})`}>
                      <circle r="18" fill="#fdc82f88" stroke="#008542" />
                      <circle r="7" fill="#008542" stroke="white" strokeWidth="2" />
                      <text x="0" y="-24" textAnchor="middle" className="marker-label">
                        {label}
                      </text>
                    </g>
                  );
                })()}
              {points.map((p, i) => {
                const screen = pageToScreen({ x: p.pdfX, y: p.pdfY }, rect, size);
                return (
                  <g key={i} transform={`translate(${screen.x} ${screen.y})`}>
                    <circle
                      r="7"
                      fill={(residuals[i] ?? 0) > tolerance ? '#b91c1c' : '#008542'}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text x="10" y="-10" className="marker-label">
                      P{i + 1}
                    </text>
                    <title>{`P${i + 1}: real ${p.realX}, ${p.realY}; PDF ${p.pdfX}, ${p.pdfY}`}</title>
                  </g>
                );
              })}
            </svg>
          </>
        )}
      </div>
      {(error || renderError || engineError) && (
        <div className="notice-error" role="alert">
          {error || renderError || 'Falha no motor PDF.'}{' '}
          <button className="button-secondary" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}
      {marker && page && !validMarker && (
        <p className="notice-error">
          TAG fora dos limites do desenho. Revise a calibração e as coordenadas.
        </p>
      )}
      {page && rect && thumbnail && (
        <div className="minimap">
          <button
            className="minimap-toggle"
            onClick={() => setMiniOpen(!miniOpen)}
            aria-expanded={miniOpen}
          >
            {miniOpen ? 'Recolher minimapa' : 'Minimapa'}
          </button>
          {miniOpen && (
            <svg
              role="img"
              aria-label="Minimapa: clique ou arraste para navegar"
              viewBox={`0 0 ${page.size.width} ${page.size.height}`}
              style={{
                aspectRatio: `${page.size.width}/${page.size.height}`,
                width:
                  page.size.height > page.size.width
                    ? `${(100 * page.size.width) / page.size.height}%`
                    : '100%',
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                navigateMini(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) navigateMini(event);
              }}
            >
              <image href={thumbnail} width={page.size.width} height={page.size.height} />
              <rect
                x={Math.max(0, rect.x)}
                y={Math.max(0, rect.y)}
                width={Math.max(
                  0,
                  Math.min(page.size.width, rect.x + rect.width) - Math.max(0, rect.x),
                )}
                height={Math.max(
                  0,
                  Math.min(page.size.height, rect.y + rect.height) - Math.max(0, rect.y),
                )}
                fill="#00854222"
                stroke="#008542"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {validMarker && (
                <circle
                  cx={validMarker.x}
                  cy={validMarker.y}
                  r={Math.max(page.size.width, page.size.height) / 55}
                  fill="#fdc82f"
                  stroke="#006b35"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          )}
        </div>
      )}
      <ViewerControls
        zoom={camera.zoom}
        onZoom={zoom}
        onFit={() =>
          page &&
          setCamera({ zoom: 1, centerX: page.size.width / 2, centerY: page.size.height / 2 })
        }
        onCenter={() =>
          validMarker &&
          setCamera({ zoom: initialZoom, centerX: validMarker.x, centerY: validMarker.y })
        }
        hasMarker={Boolean(validMarker)}
        onFullscreen={() => {
          const promise = document.fullscreenElement
            ? document.exitFullscreen()
            : root.current?.requestFullscreen?.();
          void promise?.catch(() => setRenderError('Tela cheia indisponível neste navegador.'));
        }}
      />
    </div>
  );
}
function RetryableSurface(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return <Surface key={attempt} {...props} onRetry={() => setAttempt((value) => value + 1)} />;
}
export const EmbedPdfSurface = memo(RetryableSurface);
