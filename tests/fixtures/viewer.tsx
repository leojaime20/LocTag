import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewerWorkspace } from '../../src/features/viewer/ViewerWorkspace';
import { EmbedPdfSurface } from '../../src/features/viewer/EmbedPdfSurface';
import { useViewerStore } from '../../src/stores/viewerStore';
import type { Region, SelectedTagContext } from '../../src/types/domain';
import { resolveRegion } from '../../src/utils/regions';
import { TagSummary } from '../../src/features/tags/TagSummary';
import '../../src/styles.css';
const points = [
  { realX: 0, realY: 0, pdfX: 0, pdfY: 0 },
  { realX: 800, realY: 0, pdfX: 800, pdfY: 0 },
  { realX: 0, realY: 600, pdfX: 0, pdfY: 600 },
  { realX: 800, realY: 600, pdfX: 800, pdfY: 600 },
];
const region = {
  id: 'r',
  name: 'Região de teste',
  xMin: 0,
  xMax: 800,
  yMin: 0,
  yMax: 600,
  zMin: 0,
  zMax: 600,
  plantPdf: '',
  sidePdf: '',
  plantCalibration: { id: '', pdfId: '', points: [] },
  sideCalibration: { id: '', pdfId: '', points: [] },
};
const regions: Region[] = [
  region,
  { ...region, id: 'other', name: 'Região vizinha', xMin: 800, xMax: 1600 },
];
export function Harness() {
  const [second, setSecond] = useState(false),
    [picked, setPicked] = useState(''),
    [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const change3D = (value: boolean) => {
    if (value && window.matchMedia('(max-width: 767px)').matches) setSummaryCollapsed(true);
  };
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
  if (params.has('outside')) context.tag.x = -500;
  if (params.has('invalid')) context.tag.x = NaN;
  if (params.has('noPdf')) {
    context.plantPdfUrl = null;
    context.sidePdfUrl = null;
    context.drawingsError = true;
  }
  const visibleRegions = params.has('many')
    ? [
        ...regions,
        ...Array.from({ length: 200 }, (_, i) => ({
          ...region,
          id: `extra-${i}`,
          name: `Volume ${i}`,
          xMin: 2000 + i * 15,
          xMax: 2010 + i * 15,
        })),
      ]
    : regions;
  context.resolution = resolveRegion(
    context.tag,
    params.has('empty') ? [] : (visibleRegions as (Region & typeof region)[]),
  );
  return (
    <div style={{ padding: 16 }}>
      <button className="button-secondary" onClick={() => setSecond(!second)}>
        Alternar TAG
      </button>
      <output data-testid="camera" style={{ overflowWrap: 'anywhere' }}>
        {JSON.stringify(cameras)}
      </output>
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
        <>
          <TagSummary
            context={context}
            isLoading={false}
            isCollapsed={summaryCollapsed}
            onCollapsedChange={setSummaryCollapsed}
          />
          <ViewerWorkspace
            context={context}
            regions={params.has('empty') ? [] : visibleRegions}
            isLoading={false}
            on3DChange={change3D}
          />
        </>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
