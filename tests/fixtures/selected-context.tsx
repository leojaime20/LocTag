import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { useSelectedTagContext } from '../../src/hooks/useSelectedTagContext';
import type { EquipmentTag, GlobalDrawings, Region } from '../../src/types/domain';

const tag: EquipmentTag = {
  id: 'selected',
  tag: 'TAG-3D',
  description: 'Teste',
  regionId: '',
  x: 2,
  y: 3,
  z: 4,
  type: 'Bomba',
  status: 'active',
};
const region: Region = {
  id: 'region',
  name: 'Região real',
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 10,
  zMin: 0,
  zMax: 10,
  plantPdf: '',
  sidePdf: '',
  plantCalibration: { id: '', pdfId: '', points: [] },
  sideCalibration: { id: '', pdfId: '', points: [] },
};
const drawing = {
  path: 'pdfs/indisponivel.pdf',
  pageIndex: 0,
  calibration: { id: '', pdfId: '', points: [] },
};
const drawings: GlobalDrawings = {
  version: 2,
  units: 'm',
  plant: drawing,
  side: drawing,
  initialZoom: 4,
  shareZoom: 3,
};
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});
client.setQueryData(['tag', tag.id], tag);
client.setQueryData(['regions'], [region]);
client.setQueryData(['global-drawings'], drawings);

export function Fixture() {
  const selected = useSelectedTagContext(tag);
  return (
    <main>
      <output data-testid="context-state">
        {JSON.stringify({
          ready: Boolean(selected.data),
          region: selected.data?.resolution.region?.name,
          x: selected.data?.tag.x,
          pdfError: selected.data?.drawingsError,
          hookError: selected.isError,
        })}
      </output>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <Fixture />
  </QueryClientProvider>,
);
