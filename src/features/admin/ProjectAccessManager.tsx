import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getAdminUsers, saveAdminUser } from '../../services/api/admin';
import { createProject, type Project } from '../../services/api/projects';

export function ProjectAccessManager({ projects }: { projects: Project[] }) {
  const client = useQueryClient();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const users = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers });
  const create = useMutation({
    mutationFn: () => createProject(id, name),
    onSuccess: () => {
      setId('');
      setName('');
      void client.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const save = useMutation({
    mutationFn: () => saveAdminUser(email, selected),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel space-y-3">
        <h2 className="text-xl font-semibold">Novo projeto</h2>
        <label className="field">
          ID do projeto
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="p85" />
        </label>
        <label className="field">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="P85" />
        </label>
        <button
          className="button-primary"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          Criar projeto
        </button>
        {create.isError && <p className="notice-error">{create.error.message}</p>}
        {create.isSuccess && <p className="notice">Projeto criado.</p>}
      </section>
      <section className="panel space-y-3">
        <h2 className="text-xl font-semibold">Administradores por projeto</h2>
        <p className="text-sm text-slate-500">
          Cadastre primeiro o usuário no Firebase Authentication. Em seguida, selecione os projetos
          que ele pode administrar. Desmarcar todos revoga o acesso administrativo.
        </p>
        <label className="field">
          E-mail do usuário
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            list="admin-emails"
          />
        </label>
        <datalist id="admin-emails">
          {users.data
            ?.filter((user) => user.role !== 'master')
            .map((user) => (
              <option key={user.email} value={user.email} />
            ))}
        </datalist>
        {users.isError && (
          <p className="notice-error">Não foi possível carregar os administradores.</p>
        )}
        <div className="space-y-2">
          {projects.map((project) => (
            <label key={project.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(project.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, project.id]
                      : selected.filter((value) => value !== project.id),
                  )
                }
              />
              {project.name}
            </label>
          ))}
        </div>
        <button
          className="button-primary"
          disabled={!email || save.isPending}
          onClick={() => save.mutate()}
        >
          Salvar permissões
        </button>
        {save.isError && <p className="notice-error">{save.error.message}</p>}
        {save.isSuccess && <p className="notice">Permissões salvas.</p>}
        {users.data && users.data.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <h3 className="font-semibold">Usuários cadastrados</h3>
            {users.data
              .filter((user) => user.role !== 'master')
              .map((user) => (
                <button
                  className="block text-left text-sm text-blue-600"
                  key={user.email}
                  onClick={() => {
                    setEmail(user.email);
                    setSelected(user.projectIds);
                    save.reset();
                  }}
                >
                  {user.email} ·{' '}
                  {user.projectIds.length
                    ? user.projectIds
                        .map(
                          (projectId) =>
                            projects.find((project) => project.id === projectId)?.name ?? projectId,
                        )
                        .join(', ')
                    : 'sem projetos'}
                </button>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
