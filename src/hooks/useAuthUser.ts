import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

import { auth, onAuthStateChanged } from '../services/firebase/auth';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  return { user, isReady };
}
