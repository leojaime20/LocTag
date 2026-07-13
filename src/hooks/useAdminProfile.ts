import { useQuery } from '@tanstack/react-query';

import { getCurrentAdminProfile } from '../services/api/admin';
import type { User } from 'firebase/auth';

export function useAdminProfile(user: User | null) {
  return useQuery({
    queryKey: ['admin-profile', user?.email],
    queryFn: getCurrentAdminProfile,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}
