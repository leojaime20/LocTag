import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthStatus } from '../components/AuthStatus';
import { ProjectAccessManager } from '../features/admin/ProjectAccessManager';
import { TagDataManager } from '../features/admin/TagDataManager';
import { GlobalDrawingManager } from '../features/admin/GlobalDrawingManager';
import { RegionManager } from '../features/admin/RegionManager';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { useAuthUser } from '../hooks/useAuthUser';
import { useSpatialData } from '../hooks/useSpatialData';
import { getProjects } from '../services/api/projects';
const RegionMapPanel = lazy(() => import('../features/admin/RegionMapPanel'));
type Tab = 'drawings' | 'regions' | 'map' | 'tags' | 'access';
export default function AdminPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, isReady } = useAuthUser();
  const profile = useAdminProfile(user);
  const projects = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const isMaster = profile.data?.role === 'master';
  const allowed = isMaster
    ? (projects.data ?? [])
    : (projects.data ?? []).filter(
        (project) => profile.data?.role === 'admin' && profile.data.projectIds.includes(project.id),
      );
  const selectedProject = allowed.find((project) => project.id === projectId) ?? null;
  const { regions, drawings } = useSpatialData(
    Boolean(selectedProject),
    selectedProject?.id ?? 'p84',
  );
  const [tab, setTab] = useState<Tab>('drawings');
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4 sm:p-6">
        <header className="panel flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-600">
              LocTag • Administração
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Projetos, desenhos, regiões e TAGs</h1>
            <p className="mt-2 text-sm text-slate-500">
              {!isReady || profile.isLoading || projects.isLoading
                ? 'Verificando acesso…'
                : !user
                  ? 'Entre com e-mail e senha ou com Google para acessar.'
                  : allowed.length || isMaster
                    ? 'Selecione um projeto para administrar.'
                    : 'Seu usuário não possui permissão administrativa.'}
            </p>
          </div>
          <div className="space-y-2">
            <AuthStatus user={user} isReady={isReady} />
            <Link
              className="block text-sm text-blue-600"
              to={selectedProject ? `/p/${selectedProject.id}` : '/'}
            >
              Voltar para busca
            </Link>
          </div>
        </header>
        {(allowed.length > 0 || isMaster) && (
          <>
            <section className="panel flex flex-wrap items-end gap-3">
              <label className="field min-w-52">
                Projeto
                <select
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => navigate(e.target.value ? `/admin/${e.target.value}` : '/admin')}
                >
                  <option value="">Selecione um projeto</option>
                  {allowed.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              {isMaster && (
                <button
                  className={tab === 'access' ? 'button-primary' : 'button-secondary'}
                  onClick={() => setTab('access')}
                >
                  Projetos e acessos
                </button>
              )}
            </section>
            {isMaster && tab === 'access' && (
              <ProjectAccessManager projects={projects.data ?? []} />
            )}
            {selectedProject && (
              <>
                <nav className="panel flex flex-wrap gap-2" aria-label="Áreas administrativas">
                  {(
                    [
                      ['drawings', 'Desenhos globais'],
                      ['regions', 'Regiões'],
                      ['map', 'Mapa 3D'],
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
                {tab === 'drawings' && drawings.isSuccess && (
                  <GlobalDrawingManager
                    key={selectedProject.id}
                    initial={drawings.data}
                    projectId={selectedProject.id}
                  />
                )}
                {tab === 'regions' && regions.isSuccess && (
                  <RegionManager
                    key={selectedProject.id}
                    regions={regions.data}
                    projectId={selectedProject.id}
                  />
                )}
                {tab === 'tags' && (
                  <TagDataManager
                    key={selectedProject.id}
                    regions={regions.data ?? []}
                    regionsReady={regions.isSuccess}
                    projectId={selectedProject.id}
                  />
                )}
                {tab === 'map' &&
                  (regions.isSuccess ? (
                    <Suspense
                      fallback={
                        <p role="status" className="panel">
                          Carregando mapa 3D…
                        </p>
                      }
                    >
                      <RegionMapPanel key={selectedProject.id} regions={regions.data} />
                    </Suspense>
                  ) : (
                    !regions.isError && (
                      <p role="status" className="panel">
                        Carregando regiões…
                      </p>
                    )
                  ))}
              </>
            )}
            {projectId && !selectedProject && !projects.isLoading && (
              <p className="notice-error">Você não tem acesso administrativo a este projeto.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
