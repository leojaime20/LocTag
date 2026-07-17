import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthStatus } from '../components/AuthStatus';
import { TagSearch } from '../features/tags/TagSearch';
import { TagSummary } from '../features/tags/TagSummary';
import { ViewerWorkspace } from '../features/viewer/ViewerWorkspace';
import { useAuthUser } from '../hooks/useAuthUser';
import { useSelectedTagContext } from '../hooks/useSelectedTagContext';
import type { EquipmentTag } from '../types/domain';

export default function TagLocatorPage() {
  const { user, isReady } = useAuthUser();
  const [selectedTag, setSelectedTag] = useState<EquipmentTag | null>(null);
  const selectedContext = useSelectedTagContext(selectedTag);
  const selected = selectedContext.data ?? null;

  const pageState = useMemo(() => {
    if (!isReady) return 'Verificando acesso...';
    if (!user) return 'Entre com Google para buscar tags no Firestore.';
    return 'Busque uma tag para carregar região, PDFs e coordenadas.';
  }, [isReady, user]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">LocTag</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Busca TAG</h1>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <AuthStatus user={user} isReady={isReady} />
            {user?.email === 'leojaime20@gmail.com' && (
              <Link className="text-sm font-semibold text-blue-600" to="/admin">
                Administração
              </Link>
            )}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <TagSearch disabled={!user} onSelect={setSelectedTag} />
          <p className="mt-2 text-sm text-slate-500">{pageState}</p>
        </section>

        <TagSummary context={selected} isLoading={selectedContext.isFetching} />

        {selectedContext.isError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar região/PDFs da tag selecionada. Verifique as permissões do
            Firestore e os caminhos no Firebase Storage.
          </section>
        )}

        <ViewerWorkspace context={selected} isLoading={selectedContext.isFetching} />
      </section>
    </main>
  );
}
