import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getAllTags, replaceAllTags } from '../../services/api/admin';
import type { EquipmentTag } from '../../types/domain';
import { downloadTextFile, parseCsv, tagsToCsv, validateTagRows } from '../../utils/csv';

interface ImportPreview {
  tags: EquipmentTag[];
  errors: string[];
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

export function TagDataManager() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const tagsQuery = useQuery({
    queryKey: ['admin-tags'],
    queryFn: getAllTags,
    staleTime: 30_000,
  });

  const tags = tagsQuery.data ?? emptyTags;
  const visibleTags = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const filtered = term
      ? tags.filter((tag) =>
          [tag.tag, tag.description, tag.regionId, tag.type, tag.status]
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
      : tags;

    return filtered.slice(0, 200);
  }, [filter, tags]);

  const replaceMutation = useMutation({
    mutationFn: replaceAllTags,
    onSuccess: () => {
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      void queryClient.invalidateQueries({ queryKey: ['tag-search'] });
    },
  });

  const exportCurrent = () => {
    const source = tags.length > 0 ? tags : [];
    downloadTextFile('loctag-tags.csv', tagsToCsv(source));
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
        errors: [
          'Formato ainda não suportado. Exporte sua planilha como CSV com colunas tag,description,regionId,x,y,z,type,status.',
        ],
      });
      return;
    }

    const text = await readFileAsText(file);
    const parsed = parseCsv(text);
    const validated = validateTagRows(parsed.rows);
    setPreview({
      filename: file.name,
      tags: validated.tags,
      errors: [...parsed.errors, ...validated.errors],
    });
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
          <button className="button-secondary" type="button" onClick={exportCurrent}>
            Baixar dados atuais
          </button>
          <label className="button-primary grid cursor-pointer place-items-center px-4">
            Importar CSV
            <input
              className="hidden"
              type="file"
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
            {preview.errors.length === 0
              ? `${preview.tags.length} tags válidas. Ao confirmar, a coleção tags será substituída inteira.`
              : 'Corrija os erros abaixo antes de importar.'}
          </p>
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
        <p className="mt-3 text-sm font-medium text-red-700">
          Falha ao substituir tags. Verifique permissões e tente novamente.
        </p>
      )}

      <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Tag</th>
              <th className="px-3 py-3">Descrição</th>
              <th className="px-3 py-3">Região</th>
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
                <td className="px-3 py-3 text-slate-600">{tag.regionId}</td>
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
