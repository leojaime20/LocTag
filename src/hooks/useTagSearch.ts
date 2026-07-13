import { useQuery } from '@tanstack/react-query';

import { searchTags } from '../services/api/tags';

export function useTagSearch(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tag-search', term],
    queryFn: () => searchTags(term),
    enabled: enabled && term.trim().length >= 2,
    staleTime: 60_000,
  });
}
