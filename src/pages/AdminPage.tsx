import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthStatus } from '../components/AuthStatus';
import { TagDataManager } from '../features/admin/TagDataManager';
import { GlobalDrawingManager } from '../features/admin/GlobalDrawingManager';
import { RegionManager } from '../features/admin/RegionManager';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { useAuthUser } from '../hooks/useAuthUser';
import { useSpatialData } from '../hooks/useSpatialData';
export default function AdminPage() {
  const { user, isReady } = useAuthUser();
  const profile = useAdminProfile(user),
    isAdmin = profile.data?.role === 'admin';
  const { regions, drawings } = useSpatialData(isAdmin);
  const [tab, setTab] = useState<'drawings' | 'regions' | 'tags'>('drawings');
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4 sm:p-6">
        <header className="panel flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-600">
              LocTag • Administração
            </p>
            <h1 className="text-2xl font-semibold mt-1">Desenhos, regiões e TAGs</h1>
            <p className="text-sm text-slate-500 mt-2">
              {!isReady || profile.isLoading
                ? 'Verificando acesso…'
                : !user
                  ? 'Entre com e-mail e senha ou com Google para acessar.'
                  : isAdmin
                    ? 'Administrador ativo.'
                    : 'Seu usuário não possui permissão administrativa.'}
            </p>
          </div>
          <div className="space-y-2">
            <AuthStatus user={user} isReady={isReady} />
            <Link className="block text-sm text-blue-600" to="/">
              Voltar para busca
            </Link>
          </div>
        </header>
        {isAdmin && (
          <>
            <nav className="panel flex flex-wrap gap-2" aria-label="Áreas administrativas">
              {(
                [
                  ['drawings', 'Desenhos globais'],
                  ['regions', 'Regiões'],
                  ['tags', 'TAGs e dados CSV'],
                ] as const
              ).map(([id, title]) => (
                <button
                  className={tab === id ? 'button-primary' : 'button-secondary'}
                  key={id}
                  onClick={() => setTab(id)}
                >
                  {title}
                </button>
              ))}
            </nav>
            {(regions.isError || drawings.isError) && (
              <p className="notice-error">
                Falha ao carregar a configuração. Confira as permissões e publique as regras
                atualizadas do Firestore.{' '}
                <button
                  onClick={() => {
                    void regions.refetch();
                    void drawings.refetch();
                  }}
                >
                  Tentar novamente
                </button>
              </p>
            )}
            {drawings.isSuccess && (
              <div hidden={tab !== 'drawings'}>
                <GlobalDrawingManager initial={drawings.data} />
              </div>
            )}
            {regions.isSuccess && (
              <div hidden={tab !== 'regions'}>
                <RegionManager regions={regions.data} />
              </div>
            )}
            {tab === 'tags' && <TagDataManager regions={regions.data ?? []} />}
          </>
        )}
      </div>
    </main>
  );
}
