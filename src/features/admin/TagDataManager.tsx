import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { LEGACY_PROJECT_ID } from '../../services/api/projects';
import { getAllTags, replaceAllTags } from '../../services/api/admin';
import { hasValidBounds, resolveRegion } from '../../utils/regions';
import type { Region, VolumeRegion } from '../../types/domain';
import type { EquipmentTag } from '../../types/domain';
import { downloadTextFile, parseCsv, tagsToCsv, validateTagRows } from '../../utils/csv';

interface ImportPreview {
  tags: EquipmentTag[];
  errors: string[];
  invalidCount: number;
  filename: string;
}

const emptyTags: EquipmentTag[] = [];

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}

export function TagDataManager({
  regions,
  regionsReady,
  projectId = LEGACY_PROJECT_ID,
}: {
  regions: Region[];
  regionsReady: boolean;
  projectId?: string;
}) {
  const volumes = useMemo(
    () => regions.filter((r) => !r.archived && hasValidBounds(r)) as VolumeRegion[],
    [regions],
  );
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const tagsQuery = useQuery({
    queryKey: ['admin-tags', projectId],
    queryFn: () => getAllTags(projectId),
    staleTime: 30_000,
  });

  const tags = tagsQuery.data ?? emptyTags;
  const visibleTags = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const filtered = term
      ? tags.filter((tag) =>
          [
            tag.tag,
            tag.description,
            resolveRegion(tag, volumes).label,
            tag.regionId,
            tag.moduleRegion,
            tag.owner,
            tag.elevation,
            tag.type,
            tag.status,
          ]
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
      : tags;

    return filtered.slice(0, 200);
  }, [filter, tags, volumes]);

  const replaceMutation = useMutation({
    mutationFn: (tags: EquipmentTag[]) => replaceAllTags(tags, projectId),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tags', projectId] });
    },
    onSuccess: () => {
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-tags', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tag-search', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tag', projectId] });
    },
  });

  const exportCurrent = () => {
    if (includeLocation && !regionsReady) return;
    downloadTextFile(
      includeLocation ? 'loctag-tags-com-localizacao.csv' : 'loctag-tags.csv',
      tagsToCsv(tags, includeLocation ? { locationRegions: regions } : undefined),
    );
  };

  const exportTemplate = () => {
    downloadTextFile(
      'loctag-tags-template.csv',
      tagsToCsv([
        {
          id: 'P-101A',
          tag: 'P-101A',
          description: 'Bomba de drenagem',
          regionId: 'default',
          moduleRegion: 'Módulo 01',
          owner: 'Operação',
          elevation: 'EL +20.000',
          x: 420,
          y: 280,
          z: 380,
          type: 'Processo',
          status: 'active',
        },
      ]),
    );
  };

  const handleImport = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv') {
      setPreview({
        filename: file.name,
        tags: [],
        invalidCount: 0,
        errors: [
          'Formato ainda não suportado. Exporte sua planilha como CSV com colunas tag,description,regionId,x,y,z,type,status.',
        ],
      });
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsed = parseCsv(text);
      const validated = validateTagRows(parsed.rows, parsed.lineNumbers);
      setPreview({
        filename: file.name,
        tags: validated.tags,
        errors: [...parsed.errors, ...validated.errors],
        invalidCount: parsed.invalidCount + validated.invalidCount,
      });
    } catch {
      setPreview({
        filename: file.name,
        tags: [],
        invalidCount: 0,
        errors: ['Não foi possível ler o arquivo. Selecione o CSV novamente.'],
      });
    }
  };

  return (
    <section className="panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">Tags</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Tabela de tags</h2>
          <p className="mt-2 text-sm text-slate-500">
            Veja os dados atuais, baixe o padrão CSV e substitua a coleção inteira após validação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" type="button" onClick={exportTemplate}>
            Baixar modelo
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={
              !tagsQuery.isSuccess ||
              replaceMutation.isPending ||
              (includeLocation && !regionsReady)
            }
            onClick={exportCurrent}
          >
            Baixar dados atuais
          </button>
          <label className="button-primary grid cursor-pointer place-items-center px-4">
            Importar CSV
            <input
              className="hidden"
              type="file"
              disabled={replaceMutation.isPending}
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleImport(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
        <label className="flex items-center gap-2 font-medium text-slate-700">
          <input
            type="checkbox"
            checked={includeLocation}
            onChange={(event) => setIncludeLocation(event.target.checked)}
            aria-describedby="export-location-help"
          />
          Incluir localização calculada no CSV
        </label>
        <p id="export-location-help" className="mt-1 text-slate-500">
          Acrescenta a região, o status da localização e a altura sobre o piso (m), calculados pelas
          coordenadas X, Y e Z. Para encontrar itens fora das regiões, filtre locationStatus por
          unassigned. Essas colunas são informativas e ignoradas na importação.
        </p>
        {includeLocation && !regionsReady && (
          <p className="mt-2 text-amber-700" role="status">
            A exportação com localização exige que as regiões sejam carregadas com sucesso.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <input
          className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          placeholder="Filtrar tabela atual..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="text-sm text-slate-500">
          {tagsQuery.isLoading ? 'Carregando...' : `${tags.length} tags cadastradas`}
        </span>
      </div>

      {preview && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-slate-950">Prévia da importação: {preview.filename}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {preview.tags.length} registros válidos • {preview.invalidCount} inválidos.{' '}
            {preview.errors.length === 0
              ? `${preview.tags.length} tags válidas. Ao confirmar, a coleção tags será substituída inteira.`
              : 'Corrija os erros abaixo antes de importar.'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Ao confirmar, as TAGs presentes serão atualizadas e as ausentes serão removidas. Campos
            legados das TAGs mantidas serão preservados. Operações acima de 450 alterações usam
            lotes; falhas podem interromper a substituição. Exporte os dados atuais antes de
            continuar.
          </p>
          {preview.tags.length > 0 && (
            <div className="mt-3 overflow-auto max-h-64">
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr>
                    {['TAG', 'Descrição', 'X', 'Y', 'Z', 'regionId', 'Tipo', 'Status'].map((h) => (
                      <th className="p-2 text-left" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.tags.slice(0, 20).map((t) => (
                    <tr key={t.id}>
                      {[t.tag, t.description, t.x, t.y, t.z, t.regionId, t.type, t.status].map(
                        (v, i) => (
                          <td className="p-2 border-t border-slate-100" key={i}>
                            {v}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Prévia dos primeiros 20 registros válidos.</p>
            </div>
          )}
          {preview.errors.length > 0 && (
            <ul className="mt-3 max-h-40 overflow-auto rounded-xl bg-white p-3 text-sm text-red-700">
              {preview.errors.slice(0, 50).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {preview.errors.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="button-primary"
                type="button"
                disabled={replaceMutation.isPending || preview.tags.length === 0}
                onClick={() => replaceMutation.mutate(preview.tags)}
              >
                Confirmar e substituir tabela
              </button>
              <button className="button-secondary" type="button" onClick={() => setPreview(null)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {replaceMutation.isPending && (
        <p className="mt-3 text-sm font-medium text-blue-600">Substituindo coleção tags...</p>
      )}
      {replaceMutation.isError && (
        <p className="mt-3 text-sm font-medium text-red-700">{replaceMutation.error.message}</p>
      )}

      {tagsQuery.isError && (
        <p className="notice-error">
          Falha ao consultar TAGs.{' '}
          <button onClick={() => void tagsQuery.refetch()}>Tentar novamente</button>
        </p>
      )}
      <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1500px] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Tag</th>
              <th className="px-3 py-3">Descrição</th>
              <th className="px-3 py-3">Região calculada</th>
              <th className="px-3 py-3">regionId (legado)</th>
              <th className="px-3 py-3">moduleRegion</th>
              <th className="px-3 py-3">Owner</th>
              <th className="px-3 py-3">Elevação</th>
              <th className="px-3 py-3">X</th>
              <th className="px-3 py-3">Y</th>
              <th className="px-3 py-3">Z</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleTags.map((tag) => (
              <tr className="border-t border-slate-100" key={tag.id}>
                <td className="px-3 py-3 font-semibold text-slate-950">{tag.tag}</td>
                <td className="px-3 py-3 text-slate-600">{tag.description}</td>
                <td className="px-3 py-3 text-slate-600">{resolveRegion(tag, volumes).label}</td>
                <td className="px-3 py-3 text-slate-600">{tag.regionId || '—'}</td>
                <td className="px-3 py-3 text-slate-600">{tag.moduleRegion || '—'}</td>
                <td className="px-3 py-3 text-slate-600">{tag.owner || '—'}</td>
                <td className="px-3 py-3 text-slate-600">{tag.elevation || '—'}</td>
                <td className="px-3 py-3 text-slate-600">{tag.x}</td>
                <td className="px-3 py-3 text-slate-600">{tag.y}</td>
                <td className="px-3 py-3 text-slate-600">{tag.z}</td>
                <td className="px-3 py-3 text-slate-600">{tag.type}</td>
                <td className="px-3 py-3 text-slate-600">{tag.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleTags.length < tags.length && (
        <p className="mt-2 text-xs text-slate-500">
          Mostrando 200 linhas para preservar desempenho. Use o filtro ou baixe o CSV para revisar
          tudo.
        </p>
      )}
    </section>
  );
}
