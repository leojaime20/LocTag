import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { CalibrationPoint, Drawing, GlobalDrawings, ViewKind } from '../../types/domain';
import { LEGACY_PROJECT_ID, projectPdfPath } from '../../services/api/projects';
import { saveGlobalDrawings, uploadGlobalPdf } from '../../services/api/drawings';
import { fitAffine } from '../../utils/calibration';
import { CalibrationPdfPicker } from './CalibrationPdfPicker';

const emptyDrawing = (view: ViewKind): Drawing => ({
  path: '',
  pageIndex: 0,
  calibration: { id: `global-${view}`, pdfId: '', model: 'affine', points: [], tolerance: 3 },
});
const emptyGlobals: GlobalDrawings = {
  version: 2,
  units: 'm',
  initialZoom: 4,
  shareZoom: 3,
  plant: emptyDrawing('plant'),
  side: emptyDrawing('side'),
};
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? NaN : Number(event.target.value))}
      />
    </label>
  );
}
function DrawingEditor({
  view,
  drawing,
  onChange,
  onUploading,
  projectId,
}: {
  view: ViewKind;
  drawing: Drawing;
  onChange: (drawing: Drawing) => void;
  onUploading: (busy: boolean) => void;
  projectId: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState('');
  const title = view === 'plant' ? 'Planta' : 'Lateral',
    axis = view === 'plant' ? 'Y' : 'Z';
  let fit: ReturnType<typeof fitAffine> | null = null,
    fitError = '';
  try {
    fit = fitAffine(drawing.calibration.points);
  } catch (e) {
    fitError = e instanceof Error ? e.message : 'Calibração inválida.';
  }
  const updatePoint = (index: number, patch: Partial<CalibrationPoint>) =>
    onChange({
      ...drawing,
      calibration: {
        ...drawing.calibration,
        points: drawing.calibration.points.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      },
    });
  const changePdf = (path: string, pageIndex = 0) => {
    setActive(null);
    onChange({
      ...emptyDrawing(view),
      path,
      pageIndex,
      calibration: { ...emptyDrawing(view).calibration, pdfId: path },
    });
  };
  const upload = async (file: File) => {
    setError('');
    setProgress(0);
    onUploading(true);
    try {
      const path = await uploadGlobalPdf(view, file, setProgress, projectId);
      changePdf(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload.');
    } finally {
      setProgress(null);
      onUploading(false);
    }
  };
  return (
    <section className="panel space-y-4">
      <h3 className="text-xl font-semibold">
        {title} • X/{axis}
      </h3>
      <p className="text-sm text-slate-500">
        Coordenadas reais em metros. U/V em pontos da página, origem no canto superior esquerdo.
        Recomenda-se 6 a 10 referências distribuídas pelo desenho.
      </p>
      <label className="field">
        Enviar PDF global
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={progress !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </label>
      {progress !== null && <p role="status">Enviando PDF: {progress}%</p>}
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        Caminho no Storage ({projectPdfPath(projectId, '')}…)
        <input
          value={drawing.path}
          disabled={progress !== null}
          onChange={(e) => changePdf(e.target.value)}
        />
      </label>
      <NumberField
        label="Página do desenho (a partir de 1)"
        value={drawing.pageIndex + 1}
        min={1}
        onChange={(v) => {
          if (Number.isInteger(v) && v >= 1) changePdf(drawing.path, v - 1);
        }}
      />
      <div className="notice">
        Trocar o PDF ou a página limpa os pontos deste rascunho. Os dados publicados só mudam ao
        salvar os dois desenhos.
      </div>
      <NumberField
        label="Tolerância dos resíduos (pontos PDF)"
        value={drawing.calibration.tolerance ?? 3}
        min={0.001}
        onChange={(tolerance) =>
          onChange({ ...drawing, calibration: { ...drawing.calibration, tolerance } })
        }
      />
      <div className="flex flex-wrap gap-2 items-center">
        <button className="button-secondary" onClick={() => setActive(null)}>
          Adicionar ponto por clique
        </button>
        <span className="text-sm">
          {active === null
            ? 'Clique no desenho para adicionar uma referência.'
            : `Clique para reposicionar P${active + 1}.`}
        </span>
      </div>
      <CalibrationPdfPicker
        pdfPath={drawing.path}
        pageIndex={drawing.pageIndex}
        calibration={drawing.calibration}
        residuals={fit?.residuals ?? []}
        onPick={(point) => {
          if (active !== null && drawing.calibration.points[active])
            updatePoint(active, { pdfX: point.x, pdfY: point.y });
          else {
            onChange({
              ...drawing,
              calibration: {
                ...drawing.calibration,
                points: [
                  ...drawing.calibration.points,
                  { realX: NaN, realY: NaN, pdfX: point.x, pdfY: point.y },
                ],
              },
            });
            setActive(drawing.calibration.points.length);
          }
        }}
        onReady={(handle) => {
          if (!handle) return;
          const page = { ...handle.page.size, rotation: handle.page.rotation };
          if (JSON.stringify(page) !== JSON.stringify(drawing.page)) onChange({ ...drawing, page });
        }}
      />
      <div className="space-y-3">
        {drawing.calibration.points.map((point, index) => (
          <div
            className={`rounded-xl border p-3 ${(fit?.residuals[index] ?? 0) > (drawing.calibration.tolerance ?? 3) ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
            key={index}
          >
            <div className="flex justify-between items-center gap-2">
              <button className="button-secondary" onClick={() => setActive(index)}>
                P{index + 1}
                {active === index ? ' • selecionado' : ''}
              </button>
              <span className="text-xs">Erro: {fit?.residuals[index].toFixed(3) ?? '—'} pt</span>
              <button
                className="button-secondary"
                aria-label={`Excluir ponto P${index + 1}`}
                onClick={() => {
                  setActive(null);
                  onChange({
                    ...drawing,
                    calibration: {
                      ...drawing.calibration,
                      points: drawing.calibration.points.filter((_, i) => i !== index),
                    },
                  });
                }}
              >
                Excluir
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <NumberField
                label={`P${index + 1} X (m)`}
                value={point.realX}
                onChange={(realX) => updatePoint(index, { realX })}
              />
              <NumberField
                label={`P${index + 1} ${axis} (m)`}
                value={point.realY}
                onChange={(realY) => updatePoint(index, { realY })}
              />
              <NumberField
                label={`P${index + 1} U (pt)`}
                value={point.pdfX}
                onChange={(pdfX) => updatePoint(index, { pdfX })}
              />
              <NumberField
                label={`P${index + 1} V (pt)`}
                value={point.pdfY}
                onChange={(pdfY) => updatePoint(index, { pdfY })}
              />
            </div>
          </div>
        ))}
      </div>
      <div role="status" className={fit ? 'notice' : 'notice-error'}>
        {fit
          ? `Prévia: erro médio ${fit.meanError.toFixed(3)} pt • RMSE ${fit.rmse.toFixed(3)} pt • ${fit.residuals.filter((r) => r > (drawing.calibration.tolerance ?? 3)).length} pontos acima da tolerância.`
          : fitError}
      </div>
      {fit && drawing.calibration.points.length === 3 && (
        <p className="text-sm text-slate-500">
          Com três pontos, o ajuste pode ser exato mesmo com referências incorretas. Adicione
          referências independentes para avaliar os erros.
        </p>
      )}
    </section>
  );
}
export function GlobalDrawingManager({
  initial,
  projectId = LEGACY_PROJECT_ID,
}: {
  initial: GlobalDrawings | null;
  projectId?: string;
}) {
  const [form, setForm] = useState(initial ?? emptyGlobals);
  const [uploading, setUploading] = useState({ plant: false, side: false });
  const mutation = useMutation({
    mutationFn: (config: GlobalDrawings) => saveGlobalDrawings(config, projectId),
  });
  return (
    <section className="space-y-4">
      <div className="panel">
        <h2 className="text-xl font-semibold">Desenhos globais</h2>
        <p className="text-sm text-slate-500 mt-2">
          Configuração em metros. Os uploads recebem novos caminhos e não apagam os PDFs existentes.
          Caminho deste projeto: {projectPdfPath(projectId, '')}.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(form.exampleRegionId)}
            onChange={(event) => {
              const base = { ...form };
              delete base.exampleRegionId;
              setForm(
                event.target.checked
                  ? {
                      ...base,
                      exampleRegionId:
                        projectId === LEGACY_PROJECT_ID ? 'EXEMPLO-NAVIO' : 'exemplo',
                    }
                  : base,
              );
            }}
          />
          Usar estes PDFs apenas na região ilustrativa. Desmarque ao cadastrar desenhos reais para
          todas as TAGs.
        </label>
        {form.exampleRegionId && (
          <label className="field mt-3">
            ID da região ilustrativa
            <input
              value={form.exampleRegionId}
              onChange={(event) => setForm({ ...form, exampleRegionId: event.target.value })}
            />
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <NumberField
            label="Zoom inicial (vezes o desenho completo)"
            value={form.initialZoom}
            min={1}
            max={32}
            onChange={(initialZoom) => setForm({ ...form, initialZoom })}
          />
          <NumberField
            label="Zoom do compartilhamento"
            value={form.shareZoom}
            min={1}
            max={32}
            onChange={(shareZoom) => setForm({ ...form, shareZoom })}
          />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(['plant', 'side'] as const).map((view) => (
          <DrawingEditor
            projectId={projectId}
            key={view}
            view={view}
            drawing={form[view]}
            onChange={(drawing) => {
              mutation.reset();
              setForm((current) => ({ ...current, [view]: drawing }));
            }}
            onUploading={(busy) => setUploading((current) => ({ ...current, [view]: busy }))}
          />
        ))}
      </div>
      <div className="panel">
        <button
          className="button-primary"
          disabled={uploading.plant || uploading.side || mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar desenhos globais'}
        </button>
        {mutation.isError && (
          <p className="notice-error" role="alert">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="text-blue-700 mt-3" role="status">
            Desenhos e calibrações salvos.
          </p>
        )}
      </div>
    </section>
  );
}
