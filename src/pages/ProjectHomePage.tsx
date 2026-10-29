import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getProjects } from '../services/api/projects';

export default function ProjectHomePage() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="panel">
          <p className="text-xs uppercase tracking-widest text-blue-600">LocTag</p>
          <h1 className="mt-2 text-3xl font-semibold">Escolha um projeto</h1>
          <p className="mt-2 text-sm text-slate-500">
            Selecione o projeto cujas TAGs e desenhos deseja consultar.
          </p>
        </header>
        {projects.isError && (
          <p className="notice-error">
            Não foi possível carregar os projetos.{' '}
            <button onClick={() => void projects.refetch()}>Tentar novamente</button>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(projects.data ?? [{ id: 'p84', name: 'P84' }]).map((project) => (
            <Link
              key={project.id}
              to={`/p/${project.id}`}
              className="panel block transition hover:border-blue-400 hover:shadow-md"
            >
              <strong className="text-xl">{project.name}</strong>
              <span className="mt-2 block text-sm text-blue-600">Consultar TAGs →</span>
            </Link>
          ))}
        </div>
        <Link to="/admin" className="text-sm font-semibold text-blue-600">
          Administração
        </Link>
      </div>
    </main>
  );
}
