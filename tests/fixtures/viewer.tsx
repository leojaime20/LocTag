import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewerWorkspace } from '../../src/features/viewer/ViewerWorkspace';
import { EmbedPdfSurface } from '../../src/features/viewer/EmbedPdfSurface';
import { useViewerStore } from '../../src/stores/viewerStore';
import type { SelectedTagContext } from '../../src/types/domain';
import '../../src/styles.css';
const points = [
  { realX: 0, realY: 0, pdfX: 0, pdfY: 0 },
  { realX: 800, realY: 0, pdfX: 800, pdfY: 0 },
  { realX: 0, realY: 600, pdfX: 0, pdfY: 600 },
  { realX: 800, realY: 600, pdfX: 800, pdfY: 600 },
];
export function Harness() {
  const [second, setSecond] = useState(false),
    [picked, setPicked] = useState('');
  const params = new URLSearchParams(location.search),
    page = Number(params.get('page') ?? 0);
  const cameras = useViewerStore((state) => state.views);
  const rotated = page % 2 === 1;
  const drawing = {
    path: 'pdfs/test.pdf',
    pageIndex: page,
    page: { width: rotated ? 600 : 800, height: rotated ? 800 : 600, rotation: page },
    calibration: {
      id: 'test',
      pdfId: 'pdfs/test.pdf',
      model: 'affine' as const,
      tolerance: 3,
      points,
    },
  };
  const context: SelectedTagContext = {
    tag: {
      id: 'a',
      tag: second ? 'P-202' : 'P-101A',
      description: 'Bomba de água, circuito "principal"',
      regionId: 'r',
      x: second ? 600 : 200,
      y: second ? 400 : 200,
      z: second ? 400 : 200,
      type: 'Bomba',
      status: 'active',
    },
    resolution: { region: null, matches: [], height: null, label: 'Região não identificada' },
    drawings: {
      version: 2,
      units: 'm',
      initialZoom: 3,
      shareZoom: 2,
      plant: drawing,
      side: drawing,
    },
    legacyRegion: null,
    plantPdfUrl: '/tests/fixtures/drawing.pdf',
    sidePdfUrl: '/tests/fixtures/drawing.pdf',
  };
  return (
    <div style={{ padding: 16 }}>
      <button className="button-secondary" onClick={() => setSecond(!second)}>
        Alternar TAG
      </button>
      <output data-testid="camera">{JSON.stringify(cameras)}</output>
      {params.has('picker') ? (
        <>
          <output data-testid="picked">{picked}</output>
          <EmbedPdfSurface
            pdfUrl="/tests/fixtures/drawing.pdf"
            pageIndex={page}
            marker={null}
            label={null}
            onPick={(point) => setPicked(JSON.stringify(point))}
          />
        </>
      ) : (
        <ViewerWorkspace context={context} isLoading={false} />
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
