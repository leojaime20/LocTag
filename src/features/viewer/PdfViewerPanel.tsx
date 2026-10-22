import { lazy, Suspense, useMemo, useState, useCallback } from 'react';
import type { SelectedTagContext, ViewKind } from '../../types/domain';
import { realToPdfPoint } from '../../utils/calibration';
import type { PdfHandle } from './EmbedPdfSurface';
const EmbedPdfSurface = lazy(() =>
  import('./EmbedPdfSurface').then((m) => ({ default: m.EmbedPdfSurface })),
);
interface Props {
  view: ViewKind;
  title: string;
  context: SelectedTagContext | null;
  isVisible: boolean;
  onReady: (handle: PdfHandle | null) => void;
}
export function PdfViewerPanel({ view, title, context, isVisible, onReady }: Props) {
  const [loadedPage, setLoadedPage] = useState<PdfHandle['page'] | null>(null);
  const ready = useCallback(
    (handle: PdfHandle | null) => {
      setLoadedPage(handle?.page ?? null);
      onReady(handle);
    },
    [onReady],
  );
  const pdfUrl = view === 'plant' ? context?.plantPdfUrl : context?.sidePdfUrl;
  const drawing = context?.drawings?.[view];
  const calibration =
    drawing?.calibration ??
    (view === 'plant'
      ? context?.legacyRegion?.plantCalibration
      : context?.legacyRegion?.sideCalibration);
  const position = useMemo(() => {
    if (!context || !calibration) return { marker: null, error: 'Calibração indisponível.' };
    try {
      if (
        drawing &&
        (!drawing.page ||
          drawing.calibration.model !== 'affine' ||
          drawing.calibration.pdfId !== drawing.path)
      )
        throw new Error('Calibração global indisponível ou incompatível com o PDF.');
      if (
        drawing?.page &&
        loadedPage &&
        (drawing.page.width !== loadedPage.size.width ||
          drawing.page.height !== loadedPage.size.height ||
          drawing.page.rotation !== loadedPage.rotation)
      )
        throw new Error('Dimensões ou rotação do PDF mudaram. Revise a calibração.');
      return { marker: realToPdfPoint(context.tag, view, calibration), error: '' };
    } catch (error) {
      return {
        marker: null,
        error: error instanceof Error ? error.message : 'Calibração inválida.',
      };
    }
  }, [context, view, calibration, drawing, loadedPage]);
  return (
    <section className={`viewer-panel ${isVisible ? 'flex' : 'hidden md:flex'}`}>
      <div className="border-b border-slate-200 px-3 py-2">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-slate-500">
          {context?.drawings
            ? 'Desenho global'
            : context?.legacyRegion
              ? 'Desenho regional legado • configure os desenhos globais'
              : 'Aguardando seleção'}
        </p>
      </div>
      {position.error && context && !context.drawingsLoading && !context.drawingsError && (
        <p className="notice-error">{position.error}</p>
      )}
      {context?.drawingsError ? (
        <p role="alert" className="notice-error">
          Não foi possível carregar os desenhos. A consulta 3D continua disponível.
        </p>
      ) : context?.drawingsLoading ? (
        <div className="viewer-placeholder" role="status">
          Carregando desenhos…
        </div>
      ) : pdfUrl ? (
        <Suspense fallback={<div className="viewer-placeholder">Preparando visualizador…</div>}>
          <EmbedPdfSurface
            key={`${pdfUrl}:${drawing?.pageIndex ?? 0}`}
            pdfUrl={pdfUrl}
            pageIndex={drawing?.pageIndex ?? 0}
            view={view}
            marker={position.marker}
            label={context?.tag.tag ?? null}
            initialZoom={context?.drawings?.initialZoom ?? 4}
            onReady={ready}
          />
        </Suspense>
      ) : (
        <div className="viewer-placeholder">
          {context
            ? 'PDF ainda não configurado.'
            : 'Selecione uma TAG para localizar o equipamento.'}
        </div>
      )}
    </section>
  );
}
