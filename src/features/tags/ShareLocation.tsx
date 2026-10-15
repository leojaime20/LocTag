import { useEffect, useRef, useState } from 'react';
import type { SelectedTagContext } from '../../types/domain';
import type { PdfHandle } from '../viewer/EmbedPdfSurface';
import { generateLocationImage } from '../../utils/shareImage';
export function ShareLocation({
  context,
  handles,
}: {
  context: SelectedTagContext;
  handles: { plant: PdfHandle | null; side: PdfHandle | null };
}) {
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  useEffect(() => {
    if (result) dialog.current?.showModal();
  }, [result]);
  const generate = async () => {
    if (!handles.plant || !handles.side) {
      setError('Aguarde o carregamento dos dois desenhos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const blob = await generateLocationImage(context, {
        plant: handles.plant,
        side: handles.side,
      });
      if (!alive.current) return;
      const file = new File([blob], `LocTag-${context.tag.tag.replace(/[^\w-]/g, '_')}.png`, {
        type: 'image/png',
      });
      setResult({ file, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Falha ao gerar imagem. Tente novamente.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const share = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: [result.file], title: `LocTag • ${context.tag.tag}` });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        setError('Não foi possível compartilhar. Baixe o PNG ou tente novamente.');
    }
  };
  return (
    <div>
      <button className="button-primary" disabled={busy} onClick={() => void generate()}>
        {busy ? 'Gerando imagem…' : 'Compartilhar'}
      </button>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <dialog ref={dialog} className="share-dialog" onClose={() => setResult(null)}>
          <h2 className="text-xl font-semibold">Compartilhar localização</h2>
          <img
            src={result.url}
            alt={`Prévia da localização de ${context.tag.tag} na Planta e Lateral`}
          />
          {error && <p className="notice-error">{error}</p>}
          <div className="flex flex-wrap gap-2 mt-4">
            {typeof navigator.canShare === 'function' &&
              navigator.canShare({ files: [result.file] }) && (
                <button className="button-primary" onClick={() => void share()}>
                  Compartilhar imagem
                </button>
              )}
            <a
              className="button-secondary inline-flex items-center"
              href={result.url}
              download={result.file.name}
            >
              Baixar PNG
            </a>
            <button className="button-secondary" onClick={() => dialog.current?.close()}>
              Fechar
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
