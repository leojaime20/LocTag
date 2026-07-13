import { useQuery } from '@tanstack/react-query';

import { buildSelectedTagContext } from '../services/api/tags';
import type { EquipmentTag } from '../types/domain';

export function useSelectedTagContext(tag: EquipmentTag | null) {
  return useQuery({
    queryKey: ['selected-tag-context', tag?.id],
    queryFn: () => {
      if (!tag) throw new Error('Tag não selecionada.');
      return buildSelectedTagContext(tag);
    },
    enabled: Boolean(tag),
    staleTime: 5 * 60_000,
  });
}
