import { useMemo, useState } from 'react';
import type { Region } from '../../types/domain';
import { hasValidBounds } from '../../utils/regions';
import {
  analyzeRegions,
  boundsSize,
  cutRegion,
  enclosingBounds,
  regionColor,
  type MappedRegion,
  type RegionMapConflict,
  type RegionMapView,
} from '../../utils/regionMap';
import RegionMapScene from '../spatial/RegionScene';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const views = [
  ['iso', 'Isométrica'],
  ['top', 'Superior · XY'],
  ['front', 'Frontal · XZ'],
  ['side', 'Lateral · YZ'],
] as const;

export default function RegionMapPanel({ regions }: { regions: Region[] }) {
  const analysis = useMemo(() => analyzeRegions(regions), [regions]);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isolated, setIsolated] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [labels, setLabels] = useState(true);
  const [opacity, setOpacity] = useState(0.25);
  const [showConflicts, setShowConflicts] = useState(true);
  const [cutEnabled, setCutEnabled] = useState(false);
  const [cutHeight, setCutHeight] = useState<number | null>(null);
  const [view, setView] = useState<RegionMapView>('iso');
  const [frame, setFrame] = useState(0);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const available = useMemo(
    () =>
      regions.filter(
        (region): region is MappedRegion =>
          (includeArchived || !region.archived) && hasValidBounds(region),
      ),
    [regions, includeArchived],
  );
  const bounds = useMemo(() => enclosingBounds(available), [available]);
  const matching = useMemo(
    () =>
      available.filter((region) =>
        `${region.name} ${region.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ),
    [available, search],
  );
  const visible = useMemo(
    () =>
      matching.filter(
        (region) => !hidden.has(region.id) && (!isolated || isolated.includes(region.id)),
      ),
    [matching, hidden, isolated],
  );
  const focusBounds = useMemo(
    () =>
      enclosingBounds(
        focusIds ? visible.filter((region) => focusIds.includes(region.id)) : visible,
      ) ??
      enclosingBounds(visible) ??
      bounds,
    [visible, focusIds, bounds],
  );
  const selected = available.find((region) => region.id === selectedId);
  const height = bounds
    ? Math.max(bounds.zMin, Math.min(bounds.zMax, cutHeight ?? bounds.zMax))
    : 0;
  const cut = cutEnabled ? height : null;
  const drawnCount = visible.filter((region) => cutRegion(region, cut)).length;
  const overlaps = analysis.conflicts.filter((conflict) => !conflict.contact);
  const contacts = analysis.conflicts.filter((conflict) => conflict.contact);
  const archivedCount = regions.filter((region) => region.archived).length;

  const select = (id: string) => {
    setSelectedId(id);
    setHighlightedIds([]);
  };
  const resetVisibility = () => {
    setSearch('');
    setHidden(new Set());
    setIsolated(null);
    setFocusIds(null);
    setHighlightedIds([]);
    setCutEnabled(false);
    setFrame((value) => value + 1);
  };
  const showRegion = (id: string, isolate: boolean) => {
    setSearch('');
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setIsolated(isolate ? [id] : null);
    setCutEnabled(false);
    setFocusIds([id]);
    setFrame((value) => value + 1);
  };
  const showConflict = (conflict: RegionMapConflict) => {
    const ids = [conflict.a.id, conflict.b.id];
    setSearch('');
    setHidden(new Set());
    setIsolated(ids);
    setHighlightedIds(ids);
    setSelectedId(null);
    setCutEnabled(false);
    setShowConflicts(true);
    setFocusIds(ids);
    setView('iso');
    setFrame((value) => value + 1);
  };

  return (
    <section className="panel space-y-4" aria-label="Mapa 3D de regiões">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Mapa 3D das regiões</h2>
          <p className="text-sm text-slate-500 mt-1">
            Volumes em escala real · coordenadas em metros · Z representa a altura.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm" aria-label="Resumo da análise">
          <span className="region-map-badge">
            {analysis.volumes.length} regiões ativas com volume
          </span>
          <span className="region-map-badge text-rose-700">{overlaps.length} sobreposições</span>
          <span className="region-map-badge text-amber-800">
            {contacts.length} contatos de fronteira
          </span>
          <span className="region-map-badge">{analysis.pending.length} pendências</span>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Os espaços vazios ajudam a revisar a cobertura. Para confirmar que não há lacunas, é
        necessário definir a área que deveria estar coberta.
      </p>
      <div className="region-map-layout">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Vistas do mapa">
            {views.map(([id, title]) => (
              <button
                key={id}
                className="button-secondary"
                onClick={() => {
                  setView(id);
                  setFrame((value) => value + 1);
                }}
              >
                {title}
              </button>
            ))}
            <button
              className="button-secondary"
              onClick={() => {
                setFocusIds(null);
                setFrame((value) => value + 1);
              }}
            >
              Enquadrar tudo visível
            </button>
          </div>
          <div className="region-map-viewport" aria-label="Visualização tridimensional das regiões">
            {bounds && focusBounds ? (
              <RegionMapScene
                regions={visible}
                bounds={bounds}
                focusBounds={focusBounds}
                view={view}
                frame={frame}
                selectedId={selectedId}
                highlightedIds={highlightedIds}
                opacity={opacity}
                labels={labels}
                cut={cut}
                conflicts={showConflicts ? analysis.conflicts : []}
                onSelect={select}
              />
            ) : (
              <div className="p-6 text-slate-500" role="status">
                Nenhuma região com limites válidos disponível. Cadastre os limites XYZ na aba
                Regiões.
              </div>
            )}
            {bounds && drawnCount === 0 && (
              <p className="region-map-empty" role="status">
                Nenhum bloco visível. Revise os filtros ou a altura do corte.
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <p>
              Arraste para girar · botão direito para deslocar · rolagem para zoom. No toque, use um
              dedo para girar e dois para zoom/deslocamento.
            </p>
            <p>
              Eixos: <span className="text-red-700">X vermelho</span> ·{' '}
              <span className="text-green-700">Y verde</span> ·{' '}
              <span className="text-blue-900">Z azul</span>
            </p>
          </div>
          <div className="region-map-options">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={labels}
                onChange={(event) => setLabels(event.target.checked)}
              />
              Mostrar nomes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showConflicts}
                onChange={(event) => setShowConflicts(event.target.checked)}
              />
              Destacar sobreposições
            </label>
            <label className="flex items-center gap-2">
              Opacidade{' '}
              <input
                aria-label="Opacidade dos blocos"
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
              <span>{Math.round(opacity * 100)}%</span>
            </label>
          </div>
          {bounds && (
            <div className="region-map-options">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cutEnabled}
                  onChange={(event) => setCutEnabled(event.target.checked)}
                />
                Corte horizontal por altura Z
              </label>
              {cutEnabled && (
                <>
                  <input
                    aria-label="Altura do corte (m)"
                    className="min-w-32 flex-1"
                    type="range"
                    min={bounds.zMin}
                    max={bounds.zMax}
                    step="any"
                    value={height}
                    onChange={(event) => setCutHeight(Number(event.target.value))}
                  />
                  <output>{number.format(height)} m</output>
                  <p className="w-full text-xs text-slate-500">
                    Exibe apenas a parte dos blocos abaixo do corte. Os diagnósticos consideram os
                    volumes completos.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        <aside className="min-w-0 space-y-4" aria-label="Regiões do mapa">
          <label className="field">
            Buscar região no mapa
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou ID"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span role="status">
              {drawnCount} de {available.length} blocos visíveis
            </span>
            <button className="button-secondary" onClick={resetVisibility}>
              Restaurar visualização
            </button>
          </div>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              Incluir arquivadas ({archivedCount})
            </label>
          )}
          {isolated && (
            <p className="notice">
              Exibindo apenas a seleção. Use “Restaurar visualização” para voltar.
            </p>
          )}
          <ul className="region-map-list" aria-label="Lista de regiões">
            {matching.map((region) => (
              <li
                key={region.id}
                className={
                  selectedId === region.id || highlightedIds.includes(region.id)
                    ? 'is-selected'
                    : ''
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Exibir ${region.name}`}
                  checked={!hidden.has(region.id) && (!isolated || isolated.includes(region.id))}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setHidden((current) => {
                      const next = new Set(current);
                      if (isolated)
                        available
                          .filter((item) => !isolated.includes(item.id))
                          .forEach((item) => next.add(item.id));
                      if (checked) next.delete(region.id);
                      else next.add(region.id);
                      return next;
                    });
                    setIsolated(null);
                  }}
                />
                <span
                  className="region-map-swatch"
                  style={{ background: region.archived ? '#88978e' : regionColor(region.id) }}
                />
                <button
                  className="min-w-0 flex-1 py-2 text-left"
                  aria-label={`Selecionar ${region.name}`}
                  aria-pressed={selectedId === region.id}
                  onClick={() => select(region.id)}
                >
                  <span className="block break-words font-semibold">{region.name}</span>
                  <span className="text-xs text-slate-500 break-all">
                    {region.id}
                    {region.archived ? ' · arquivada' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {matching.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma região encontrada.</p>
          )}
          {selected ? (
            <div
              className="rounded-xl border border-slate-200 p-3 space-y-2"
              aria-label="Detalhes da região selecionada"
            >
              <h3 className="font-semibold break-words">{selected.name}</h3>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <p key={axis} className="text-sm">
                  {axis.toUpperCase()}: {number.format(selected[`${axis}Min`])} a{' '}
                  {number.format(selected[`${axis}Max`])} m
                </p>
              ))}
              <p className="text-sm">
                Dimensões (X × Y × Z):{' '}
                {boundsSize(selected)
                  .map((value) => number.format(value))
                  .join(' × ')}{' '}
                m
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="button-secondary" onClick={() => showRegion(selected.id, false)}>
                  Focar região
                </button>
                <button className="button-secondary" onClick={() => showRegion(selected.id, true)}>
                  Isolar região
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Selecione um bloco ou um nome para consultar seus limites.
            </p>
          )}
        </aside>
      </div>
      <div
        className="border-t border-slate-200 pt-4 space-y-3"
        aria-label="Diagnóstico das regiões"
      >
        <h3 className="font-semibold">Diagnóstico de todas as regiões ativas</h3>
        <p className="text-sm text-slate-500">
          Filtros, corte e regiões ocultas não alteram esta análise. Arquivadas não participam.
          Clique em um conflito para isolar e enquadrar as duas regiões.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-rose-700">
              Sobreposições e contenções ({overlaps.length})
            </h4>
            {overlaps.length ? (
              <ul className="region-map-conflicts">
                {overlaps.map((conflict) => (
                  <li key={JSON.stringify([conflict.a.id, conflict.b.id])}>
                    <button onClick={() => showConflict(conflict)} className="region-map-conflict">
                      <strong>
                        {conflict.a.name} ↔ {conflict.b.name}
                      </strong>
                      <span>
                        {conflict.label} · interseção:{' '}
                        {number.format(
                          boundsSize(conflict.intersection).reduce(
                            (volume, size) => volume * size,
                            1,
                          ),
                        )}{' '}
                        m³
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma sobreposição entre os volumes ativos válidos.
              </p>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-800">
              Contatos de fronteira ({contacts.length})
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Faces, arestas ou pontos encostados. Como os limites são inclusivos, TAGs na fronteira
              podem pertencer a mais de uma região.
            </p>
            {contacts.length ? (
              <ul className="region-map-conflicts">
                {contacts.map((conflict) => (
                  <li key={JSON.stringify([conflict.a.id, conflict.b.id])}>
                    <button onClick={() => showConflict(conflict)} className="region-map-conflict">
                      <strong>
                        {conflict.a.name} ↔ {conflict.b.name}
                      </strong>
                      <span>Contato sem volume de interseção</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Nenhum contato de fronteira.</p>
            )}
          </div>
        </div>
        {analysis.pending.length > 0 && (
          <div className="notice">
            <strong>
              Pendências: regiões ativas sem limites válidos ({analysis.pending.length})
            </strong>
            <p>
              Estas regiões não podem ser desenhadas nem analisadas. Revise os seis limites na aba
              Regiões.
            </p>
            <ul className="mt-2 list-disc pl-5">
              {analysis.pending.map((region) => (
                <li key={region.id}>
                  {region.name} ({region.id})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
