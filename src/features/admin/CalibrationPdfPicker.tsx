import { useQuery } from '@tanstack/react-query';
import { EmbedPdfSurface, type PdfHandle } from '../viewer/EmbedPdfSurface';
import { resolveStorageUrl } from '../../services/firebase/storage';
import type { Calibration } from '../../types/domain';
import type { PdfPoint } from '../../utils/calibration';
export function CalibrationPdfPicker({
  pdfPath,
  pageIndex,
  calibration,
  residuals,
  onPick,
  onReady,
}: {
  pdfPath: string;
  pageIndex: number;
  calibration: Calibration;
  residuals: number[];
  onPick: (point: PdfPoint) => void;
  onReady: (handle: PdfHandle | null) => void;
}) {
  const url = useQuery({
    queryKey: ['pdf-url', pdfPath],
    queryFn: () => resolveStorageUrl(pdfPath),
    enabled: Boolean(pdfPath),
    staleTime: Infinity,
  });
  if (!pdfPath)
    return <p className="notice">Envie ou selecione um PDF para cadastrar os pontos.</p>;
  if (url.isError)
    return (
      <p className="notice-error">
        Não foi possível acessar o PDF.{' '}
        <button onClick={() => void url.refetch()}>Tentar novamente</button>
      </p>
    );
  if (!url.data) return <p>Carregando PDF…</p>;
  return (
    <EmbedPdfSurface
      key={`${url.data}:${pageIndex}`}
      pdfUrl={url.data}
      pageIndex={pageIndex}
      marker={null}
      label={null}
      points={calibration.points}
      residuals={residuals}
      tolerance={calibration.tolerance}
      onPick={onPick}
      onReady={onReady}
    />
  );
}
