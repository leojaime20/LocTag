import type { User } from 'firebase/auth';
import { useState } from 'react';

import { signInWithEmail, signInWithGoogle, signOutUser } from '../services/firebase/auth';

interface AuthStatusProps {
  user: User | null;
  isReady: boolean;
}

export function AuthStatus({ user, isReady }: AuthStatusProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function authenticate(action: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await action();
      setPassword('');
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(
        code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
          : code === 'auth/network-request-failed'
            ? 'Falha de conexão. Confira sua internet e tente novamente.'
            : 'Não foi possível entrar. Confira seus dados ou tente novamente.',
      );
    } finally {
      setPending(false);
    }
  }

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
        <div className="w-full space-y-3 sm:w-80">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void authenticate(() => signInWithEmail(email, password));
            }}
          >
            <label className="field">
              E-mail
              <input
                type="email"
                autoComplete="username"
                required
                disabled={pending}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button-primary w-full" type="submit" disabled={pending}>
              {pending ? 'Entrando…' : 'Entrar com e-mail e senha'}
            </button>
          </form>
          <button
            className="button-secondary w-full"
            type="button"
            disabled={pending}
            onClick={() => void authenticate(signInWithGoogle)}
          >
            Entrar com Google
          </button>
          {error && (
            <p className="notice-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
