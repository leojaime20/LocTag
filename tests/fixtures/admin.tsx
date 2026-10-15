import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RegionManager } from '../../src/features/admin/RegionManager';
import { GlobalDrawingManager } from '../../src/features/admin/GlobalDrawingManager';
import { TagDataManager } from '../../src/features/admin/TagDataManager';
import type { GlobalDrawings, Region } from '../../src/types/domain';
import '../../src/styles.css';
const calibration = {
  id: 'fixture',
  pdfId: 'fixture',
  points: [],
  model: 'affine' as const,
  tolerance: 3,
};
const regions: Region[] = [
  {
    id: 'a',
    name: 'Deck A',
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 10,
    zMin: 0,
    zMax: 10,
    plantPdf: '',
    sidePdf: '',
    plantCalibration: calibration,
    sideCalibration: calibration,
  },
];
const client = new QueryClient();
client.setQueryData(['admin-tags'], []);
const drawing = { path: new URL('./drawing.pdf', location.href).href, pageIndex: 0, calibration };
const globals: GlobalDrawings = {
  version: 2,
  units: 'm',
  initialZoom: 4,
  shareZoom: 3,
  plant: drawing,
  side: drawing,
};
const mode = new URLSearchParams(location.search).get('mode');
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <div className="p-4">
      {mode === 'csv' ? (
        <TagDataManager regions={regions} />
      ) : mode === 'calibration' ? (
        <GlobalDrawingManager initial={globals} />
      ) : (
        <RegionManager regions={regions} />
      )}
    </div>
  </QueryClientProvider>,
);
