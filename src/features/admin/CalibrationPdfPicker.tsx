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
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { resolveStorageUrl } from '../../services/firebase/storage';
import type { Calibration } from '../../types/domain';

interface CalibrationPdfPickerProps {
  activePointIndex: number;
  calibration: Calibration;
  pdfPath: string;
  title: string;
  onPick: (pointIndex: number, pdfX: number, pdfY: number) => void;
  onSelectPoint: (pointIndex: number) => void;
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

export function CalibrationPdfPicker({
  activePointIndex,
  calibration,
  pdfPath,
  title,
  onPick,
  onSelectPoint,
}: CalibrationPdfPickerProps) {
  const { engine, isLoading: isEngineLoading, error: engineError } = usePdfiumEngine();
  const pdfQuery = useQuery({
    queryKey: ['admin-calibration-pdf-url', pdfPath],
    queryFn: () => resolveStorageUrl(pdfPath),
    enabled: pdfPath.trim().length > 0,
    staleTime: 5 * 60_000,
  });

  const pdfUrl = pdfQuery.data ?? null;
  const documentId = useMemo(() => {
    if (!pdfUrl) return 'admin-calibration-empty';
    return `admin-calibration-${btoa(pdfUrl).replace(/[^a-zA-Z0-9]/g, '')}`;
  }, [pdfUrl]);
  const plugins = useMemo(() => {
    if (!pdfUrl) return [];
    return [
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
    ];
  }, [documentId, pdfUrl]);

  if (!pdfPath) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Envie e salve o PDF antes de calibrar por clique.
      </div>
    );
  }

  if (pdfQuery.isLoading || isEngineLoading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Carregando PDF para calibração...
      </div>
    );
  }

  if (pdfQuery.isError || engineError || !engine || !pdfUrl) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Não foi possível abrir o PDF para calibração.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="ml-2">
          Ponto ativo: P{activePointIndex + 1}. Clique no desenho para preencher PDF X/Y.
        </span>
      </div>
      <div className="h-[520px] overflow-auto bg-slate-100 p-3">
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
                          <div className="relative bg-white shadow-sm" style={{ width, height }}>
                            <RenderLayer documentId={activeDocumentId} pageIndex={pageIndex} />
                            {pageIndex === 0 && (
                              <>
                                <button
                                  aria-label={`Capturar coordenada do ponto P${activePointIndex + 1}`}
                                  className="absolute inset-0 cursor-crosshair appearance-none border-0 bg-transparent p-0"
                                  type="button"
                                  onClick={(event) => {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    const pdfX = ((event.clientX - rect.left) / rect.width) * width;
                                    const pdfY =
                                      ((event.clientY - rect.top) / rect.height) * height;
                                    onPick(
                                      activePointIndex,
                                      roundCoordinate(pdfX),
                                      roundCoordinate(pdfY),
                                    );
                                  }}
                                />
                                <svg
                                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                                  viewBox={`0 0 ${width} ${height}`}
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  {calibration.points.map((point, index) => (
                                    <g
                                      key={index}
                                      transform={`translate(${point.pdfX} ${point.pdfY})`}
                                    >
                                      <circle
                                        r="10"
                                        fill={
                                          index === activePointIndex
                                            ? 'rgb(37 99 235 / 0.22)'
                                            : 'rgb(15 23 42 / 0.12)'
                                        }
                                        stroke={index === activePointIndex ? '#2563eb' : '#475569'}
                                        strokeWidth="2"
                                      />
                                      <text
                                        x="14"
                                        y="-12"
                                        fill={index === activePointIndex ? '#1d4ed8' : '#334155'}
                                        fontSize="18"
                                        fontWeight="700"
                                        paintOrder="stroke"
                                        stroke="white"
                                        strokeWidth="4"
                                      >
                                        P{index + 1}
                                      </text>
                                    </g>
                                  ))}
                                </svg>
                              </>
                            )}
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
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white p-3">
        {calibration.points.map((point, index) => (
          <button
            className={`control-button ${index === activePointIndex ? 'border-blue-500 text-blue-700' : ''}`}
            key={index}
            type="button"
            onClick={() => onSelectPoint(index)}
          >
            P{index + 1}: PDF {point.pdfX}, {point.pdfY}
          </button>
        ))}
      </div>
    </div>
  );
}
