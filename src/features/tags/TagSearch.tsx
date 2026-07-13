import { useDeferredValue, useMemo, useState } from 'react';

import { useTagSearch } from '../../hooks/useTagSearch';
import type { EquipmentTag } from '../../types/domain';

interface TagSearchProps {
  disabled: boolean;
  onSelect: (tag: EquipmentTag) => void;
}

export function TagSearch({ disabled, onSelect }: TagSearchProps) {
  const [term, setTerm] = useState('');
  const [isOpen, setOpen] = useState(false);
  const deferredTerm = useDeferredValue(term);
  const search = useTagSearch(deferredTerm, !disabled);
  const results = search.data ?? [];
  const statusText = useMemo(() => {
    if (disabled) return 'Login necessário';
    if (deferredTerm.trim().length < 2) return 'Digite ao menos 2 caracteres';
    if (search.isFetching) return 'Buscando no Firestore';
    if (results.length === 0) return 'Nenhuma tag encontrada';
    return `${results.length} resultado${results.length === 1 ? '' : 's'}`;
  }, [deferredTerm, disabled, results.length, search.isFetching]);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="tag-search">
        Pesquisar TAG
      </label>
      <input
        id="tag-search"
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
        placeholder="Ex.: P-101A, bomba, válvula..."
        value={term}
        disabled={disabled}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => setOpen(true)}
      />
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {statusText}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.map((tag) => (
            <button
              className="flex w-full flex-col rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"
              key={tag.id}
              type="button"
              onClick={() => {
                setTerm(tag.tag);
                setOpen(false);
                onSelect(tag);
              }}
            >
              <span className="font-semibold text-slate-950">{tag.tag}</span>
              <span className="text-sm text-slate-500">{tag.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
