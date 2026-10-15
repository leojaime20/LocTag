import { useEffect, useState } from 'react';
import type { PdfEngine } from '@embedpdf/models';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

// Own the lifecycle explicitly: late initialization after an unmount (including
// React StrictMode) must release its worker instead of retaining a second engine.
export function usePdfEngine() {
  const [engine, setEngine] = useState<PdfEngine | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let disposed = false;
    let instance: PdfEngine | null = null;
    const release = (value: PdfEngine) => {
      void value
        .destroy?.()
        .toPromise()
        .catch(() => {});
    };
    void import('@embedpdf/engines/pdfium-worker-engine')
      .then(({ createPdfiumEngine }) => {
        const created = createPdfiumEngine(new URL(wasmUrl, window.location.href).href);
        if (disposed) {
          release(created);
          return;
        }
        instance = created;
        setEngine(created);
      })
      .catch((cause) => {
        if (!disposed)
          setError(new Error('Não foi possível iniciar o motor PDF. Tente novamente.', { cause }));
      });
    return () => {
      disposed = true;
      if (instance) release(instance);
    };
  }, []);
  return { engine, error };
}
