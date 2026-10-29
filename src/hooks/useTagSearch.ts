import { useQuery } from '@tanstack/react-query';

import { LEGACY_PROJECT_ID } from '../services/api/projects';
import { searchTags } from '../services/api/tags';

export function useTagSearch(term: string, enabled: boolean, projectId = LEGACY_PROJECT_ID) {
  return useQuery({
    queryKey: ['tag-search', projectId, term],
    queryFn: () => searchTags(term, projectId),
    enabled: enabled && term.trim().length >= 2,
    staleTime: 60_000,
  });
}
