import type { SelectedTagContext } from '../../types/domain';

interface TagSummaryProps {
  context: SelectedTagContext | null;
  isLoading: boolean;
  isCollapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}

export function TagSummary({
  context,
  isLoading,
  isCollapsed,
  onCollapsedChange,
}: TagSummaryProps) {
  if (isLoading) {
    return <section className="panel text-sm text-slate-500">Carregando resumo da tag...</section>;
  }

  if (!context) {
    return <section className="panel text-sm text-slate-500">Nenhuma tag selecionada.</section>;
  }

  if (isCollapsed) {
    return (
      <section className="panel flex items-center justify-between gap-3">
        <div className="min-w-0 break-words">
          <span className="font-semibold text-slate-900">{context.tag.tag}</span>
          <p className="text-sm text-slate-500">{context.resolution.label}</p>
        </div>
        <button className="button-secondary" type="button" onClick={() => onCollapsedChange(false)}>
          Expandir
        </button>
      </section>
    );
  }

  const fields = [
    ['Descrição', context.tag.description],
    [
      'Região',
      context.legacyRegion && !context.resolution.region
        ? `${context.resolution.label} (cadastro legado: ${context.legacyRegion.name})`
        : context.resolution.label,
    ],
    ['moduleRegion', context.tag.moduleRegion || '—'],
    ['Owner', context.tag.owner || '—'],
    ['Elevação', context.tag.elevation || '—'],
    ['X', `${context.tag.x} m`],
    ['Y', `${context.tag.y} m`],
    ['Z', `${context.tag.z} m`],
    [
      'Altura aproximada',
      context.resolution.height === null
        ? ''
        : `${context.resolution.height.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 1 })} m`,
    ],
    [
      'Status',
      { active: 'Ativo', inactive: 'Inativo', unknown: 'Desconhecido' }[context.tag.status],
    ],
    ['Tipo', context.tag.type],
  ];

  return (
    <section className="panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">Resumo</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{context.tag.tag}</h2>
        </div>
        <button className="button-secondary" type="button" onClick={() => onCollapsedChange(true)}>
          Recolher
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {fields.map(([label, value]) => (
          <div className="rounded-xl bg-slate-50 px-3 py-2" key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
