import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { TagSearch } from '../features/tags/TagSearch';
import { TagSummary } from '../features/tags/TagSummary';
import { ViewerWorkspace } from '../features/viewer/ViewerWorkspace';
import { useSelectedTagContext } from '../hooks/useSelectedTagContext';
import type { EquipmentTag } from '../types/domain';

export default function TagLocatorPage() {
  const { projectId = 'p84' } = useParams();
  const [selectedTag, setSelectedTag] = useState<EquipmentTag | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const change3D = (value: boolean) => {
    if (value && window.matchMedia('(max-width: 767px)').matches) setSummaryCollapsed(true);
  };
  const selectedContext = useSelectedTagContext(selectedTag, projectId);
  const selected = selectedContext.data ?? null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">LocTag</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {projectId.toUpperCase()} · Busca TAG
            </h1>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Link className="text-sm font-semibold text-blue-600" to="/">
              Projetos
            </Link>
            <Link className="text-sm font-semibold text-blue-600" to={`/admin/${projectId}`}>
              Administração
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <TagSearch projectId={projectId} onSelect={setSelectedTag} />
          <p className="mt-2 text-sm text-slate-500">
            Busque uma TAG para localizar o equipamento nos desenhos globais.
          </p>
        </section>

        <TagSummary
          context={selected}
          isLoading={selectedContext.isFetching}
          isCollapsed={summaryCollapsed}
          onCollapsedChange={setSummaryCollapsed}
        />

        {selected?.drawings?.exampleRegionId && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Exemplo ilustrativo: o desenho e as coordenadas desta TAG demonstram a localização; não
            representam medições de engenharia.
          </p>
        )}

        {selectedContext.isError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar a TAG ou suas regiões. Verifique a conexão e tente selecionar
            a TAG novamente.
          </section>
        )}

        <ViewerWorkspace
          context={selected}
          regions={selectedContext.regions}
          isLoading={selectedContext.isFetching}
          on3DChange={change3D}
        />
      </section>
    </main>
  );
}
