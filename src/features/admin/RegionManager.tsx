import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { Region, VolumeRegion } from '../../types/domain';
import { archiveRegion, saveVolumeRegion } from '../../services/api/drawings';
import { hasValidBounds, regionConflict } from '../../utils/regions';
import { NumberField } from './GlobalDrawingManager';
const empty: VolumeRegion = {
  id: '',
  name: '',
  xMin: NaN,
  xMax: NaN,
  yMin: NaN,
  yMax: NaN,
  zMin: NaN,
  zMax: NaN,
};
export function RegionManager({ regions }: { regions: Region[] }) {
  const [form, setForm] = useState<VolumeRegion>(empty),
    [creating, setCreating] = useState(true);
  const [filter, setFilter] = useState(''),
    [acknowledged, setAcknowledged] = useState(''),
    [deleting, setDeleting] = useState<string | null>(null);
  const conflicts = hasValidBounds(form)
    ? regions
        .filter((r) => !r.archived && r.id !== form.id && hasValidBounds(r))
        .flatMap((r) => {
          const conflict = regionConflict(form, r as VolumeRegion);
          return conflict ? [{ id: r.id, name: r.name, conflict }] : [];
        })
    : [];
  const conflictKey = JSON.stringify([form, conflicts]);
  const save = useMutation({
    mutationFn: () => saveVolumeRegion(form, creating),
    onSuccess: () => {
      setForm(empty);
      setCreating(true);
      setAcknowledged('');
    },
  });
  const archive = useMutation({ mutationFn: archiveRegion, onSuccess: () => setDeleting(null) });
  const update = (patch: Partial<VolumeRegion>) => {
    save.reset();
    setForm({ ...form, ...patch });
    setAcknowledged('');
  };
  return (
    <section className="panel space-y-4">
      <h2 className="text-xl font-semibold">Regiões • volumes XYZ</h2>
      <p className="text-sm text-slate-500">
        Limites inclusivos em metros. Regiões legadas sem limites ficam disponíveis para cadastro,
        mas não participam da identificação espacial.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          ID da região
          <input
            value={form.id}
            disabled={!creating}
            onChange={(e) => update({ id: e.target.value })}
          />
        </label>
        <label className="field">
          Nome da região
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        {(['x', 'y', 'z'] as const).flatMap((axis) =>
          (['Min', 'Max'] as const).map((bound) => (
            <NumberField
              key={axis + bound}
              label={`${axis.toUpperCase()} ${bound === 'Min' ? 'mínimo' : 'máximo'} (m)`}
              value={form[`${axis}${bound}`]}
              onChange={(value) => update({ [`${axis}${bound}`]: value })}
            />
          )),
        )}
      </div>
      {!hasValidBounds(form) && (
        <p className="text-sm text-slate-500">
          Preencha todos os limites. Em cada eixo, o mínimo deve ser menor que o máximo.
        </p>
      )}
      {conflicts.length > 0 && (
        <div className="notice">
          <strong>Atenção! Conflitos com regiões existentes:</strong>
          <ul>
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.name}: {c.conflict}
              </li>
            ))}
          </ul>
          <label className="flex gap-2 items-start mt-3">
            <input
              type="checkbox"
              checked={acknowledged === conflictKey}
              onChange={(e) => setAcknowledged(e.target.checked ? conflictKey : '')}
            />
            Revisei os conflitos e desejo manter estes limites.
          </label>
        </div>
      )}
      <div className="flex gap-2">
        <button
          className="button-primary"
          disabled={
            !hasValidBounds(form) ||
            !form.name.trim() ||
            !form.id ||
            save.isPending ||
            (conflicts.length > 0 && acknowledged !== conflictKey)
          }
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Salvando…' : creating ? 'Criar região' : 'Salvar região'}
        </button>
        <button
          className="button-secondary"
          onClick={() => {
            setForm(empty);
            setCreating(true);
            save.reset();
          }}
        >
          Nova / cancelar edição
        </button>
      </div>
      {save.isError && <p className="notice-error">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Região salva.</p>}
      <label className="field">
        Pesquisar regiões
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Nome da região"
        />
      </label>
      <div className="space-y-2">
        {regions
          .filter((r) => r.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
          .map((r) => (
            <div className="rounded-xl border border-slate-200 p-3" key={r.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong>{r.name}</strong>
                  <p className="text-xs text-slate-500">
                    {r.id}
                    {r.archived ? ' • arquivada' : ''}
                  </p>
                  <p className="text-sm mt-2">
                    {hasValidBounds(r)
                      ? `X: ${r.xMin} a ${r.xMax} m • Y: ${r.yMin} a ${r.yMax} m • Z: ${r.zMin} a ${r.zMax} m`
                      : 'Região legada — limites não cadastrados'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setForm({
                        id: r.id,
                        name: r.name,
                        xMin: r.xMin ?? NaN,
                        xMax: r.xMax ?? NaN,
                        yMin: r.yMin ?? NaN,
                        yMax: r.yMax ?? NaN,
                        zMin: r.zMin ?? NaN,
                        zMax: r.zMax ?? NaN,
                      });
                      setCreating(false);
                      setAcknowledged('');
                      save.reset();
                    }}
                  >
                    {r.archived ? 'Restaurar / editar' : 'Editar'}
                  </button>
                  {!r.archived && (
                    <button className="button-secondary" onClick={() => setDeleting(r.id)}>
                      Excluir
                    </button>
                  )}
                </div>
              </div>
              {deleting === r.id && (
                <div className="notice mt-3">
                  Excluir “{r.name}” da identificação? O documento, PDFs e calibrações serão
                  preservados como arquivo.
                  <div className="flex gap-2 mt-2">
                    <button
                      className="button-primary"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate(r.id)}
                    >
                      Confirmar exclusão
                    </button>
                    <button className="button-secondary" onClick={() => setDeleting(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
      {archive.isError && <p className="notice-error">{archive.error.message}</p>}
    </section>
  );
}
