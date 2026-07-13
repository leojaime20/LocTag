import type { User } from 'firebase/auth';

import { signInWithGoogle, signOutUser } from '../services/firebase/auth';

interface AuthStatusProps {
  user: User | null;
  isReady: boolean;
}

export function AuthStatus({ user, isReady }: AuthStatusProps) {
  if (!isReady) {
    return <div className="text-sm text-slate-500">Autenticação...</div>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {user ? (
        <>
          <span className="max-w-[260px] truncate text-sm text-slate-500">{user.email}</span>
          <button className="button-secondary" type="button" onClick={() => void signOutUser()}>
            Sair
          </button>
        </>
      ) : (
        <button className="button-primary" type="button" onClick={() => void signInWithGoogle()}>
          Entrar com Google
        </button>
      )}
    </div>
  );
}
