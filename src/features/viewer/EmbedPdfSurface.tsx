import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react';
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react';
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react';
import { Viewport, ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { memo, useMemo } from 'react';

import type { PdfPoint } from '../../utils/calibration';
import { MarkerOverlay } from './MarkerOverlay';

interface EmbedPdfSurfaceProps {
  pdfUrl: string;
  marker: PdfPoint | null;
  label: string | null;
}

function EmbedPdfSurfaceComponent({ pdfUrl, marker, label }: EmbedPdfSurfaceProps) {
  const { engine, isLoading, error } = usePdfiumEngine();
  const documentId = useMemo(() => `doc-${btoa(pdfUrl).replace(/[^a-zA-Z0-9]/g, '')}`, [pdfUrl]);
  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [
          {
            url: pdfUrl,
            documentId,
            mode: 'full-fetch',
            autoActivate: true,
          },
        ],
      }),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
    ],
    [documentId, pdfUrl],
  );

  if (isLoading) return <div className="viewer-placeholder">Carregando engine PDF...</div>;
  if (error || !engine) return <div className="viewer-placeholder">PDF indisponível.</div>;

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ activeDocumentId }) =>
        activeDocumentId && (
          <DocumentContent documentId={activeDocumentId}>
            {({ documentState, isLoaded, isError }) => {
              if (isError) {
                return (
                  <div className="viewer-placeholder">
                    Falha ao abrir PDF.
                    <span className="mt-2 max-w-md break-words text-xs text-slate-400">
                      {documentState?.error ?? 'O viewer não retornou detalhes.'}
                    </span>
                  </div>
                );
              }
              if (!isLoaded) return <div className="viewer-placeholder">Carregando PDF...</div>;

              return (
                <Viewport className="h-full bg-slate-100" documentId={activeDocumentId}>
                  <Scroller
                    documentId={activeDocumentId}
                    renderPage={({ width, height, pageIndex }) => (
                      <div className="relative" style={{ width, height }}>
                        <RenderLayer documentId={activeDocumentId} pageIndex={pageIndex} />
                        {pageIndex === 0 && <MarkerOverlay marker={marker} label={label} />}
                      </div>
                    )}
                  />
                </Viewport>
              );
            }}
          </DocumentContent>
        )
      }
    </EmbedPDF>
  );
}

export const EmbedPdfSurface = memo(EmbedPdfSurfaceComponent);
