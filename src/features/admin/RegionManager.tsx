import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Region, VolumeRegion } from '../../types/domain';
import { LEGACY_PROJECT_ID } from '../../services/api/projects';
import { archiveRegion, deleteRegion, saveVolumeRegion } from '../../services/api/drawings';
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
export function RegionManager({
  regions,
  projectId = LEGACY_PROJECT_ID,
}: {
  regions: Region[];
  projectId?: string;
}) {
  const client = useQueryClient();
  const [form, setForm] = useState<VolumeRegion>(empty),
    [creating, setCreating] = useState(true);
  const [filter, setFilter] = useState(''),
    [acknowledged, setAcknowledged] = useState(''),
    [deleting, setDeleting] = useState<{ id: string; permanent: boolean } | null>(null);
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
    mutationFn: () => saveVolumeRegion(form, creating, projectId),
    onSuccess: () => {
      setForm(empty);
      setCreating(true);
      setAcknowledged('');
    },
  });
  const remove = useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent: boolean }) =>
      permanent ? deleteRegion(id, projectId) : archiveRegion(id, projectId),
    onSuccess: (_, { id, permanent }) => {
      client.setQueryData<Region[]>(['regions', projectId], (current) =>
        permanent
          ? current?.filter((region) => region.id !== id)
          : current?.map((region) => (region.id === id ? { ...region, archived: true } : region)),
      );
      if (form.id === id) {
        setForm(empty);
        setCreating(true);
        setAcknowledged('');
        save.reset();
      }
      setDeleting(null);
    },
  });
  const requestRemoval = (id: string, permanent: boolean) => {
    remove.reset();
    setDeleting({ id, permanent });
  };
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
            remove.isPending ||
            (conflicts.length > 0 && acknowledged !== conflictKey)
          }
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Salvando…' : creating ? 'Criar região' : 'Salvar região'}
        </button>
        <button
          className="button-secondary"
          disabled={remove.isPending}
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
                <div className="flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={remove.isPending || save.isPending}
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
                    <button
                      className="button-secondary"
                      disabled={remove.isPending || save.isPending}
                      onClick={() => requestRemoval(r.id, false)}
                    >
                      Arquivar
                    </button>
                  )}
                  <button
                    className="button-secondary text-red-700"
                    disabled={remove.isPending || save.isPending}
                    onClick={() => requestRemoval(r.id, true)}
                  >
                    Excluir definitivamente
                  </button>
                </div>
              </div>
              {deleting?.id === r.id && (
                <div className="notice mt-3">
                  {deleting.permanent ? (
                    <p>
                      Excluir definitivamente “{r.name}”? O cadastro e suas calibrações serão
                      removidos, sem possibilidade de restauração. As TAGs e os arquivos PDF serão
                      preservados, mas o vínculo com os desenhos desta região será perdido.
                    </p>
                  ) : (
                    <p>
                      Arquivar “{r.name}” e retirá-la da identificação? O cadastro, PDFs e
                      calibrações serão preservados para restauração.
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      className="button-primary"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(deleting)}
                    >
                      {remove.isPending
                        ? 'Processando…'
                        : deleting.permanent
                          ? 'Confirmar exclusão definitiva'
                          : 'Confirmar arquivamento'}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={remove.isPending}
                      onClick={() => {
                        setDeleting(null);
                        remove.reset();
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
      {remove.isError && (
        <p role="alert" className="notice-error">
          {remove.error.message}
        </p>
      )}
      {remove.isSuccess && (
        <p role="status">
          {remove.variables.permanent ? 'Região excluída definitivamente.' : 'Região arquivada.'}
        </p>
      )}
    </section>
  );
}
