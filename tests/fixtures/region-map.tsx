import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RegionMapPanel from '../../src/features/admin/RegionMapPanel';
import type { Region } from '../../src/types/domain';
import '../../src/styles.css';

const base: Region = {
  id: 'a',
  name: 'Deck A',
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 10,
  zMin: 0,
  zMax: 5,
  plantPdf: '',
  sidePdf: '',
  plantCalibration: { id: '', pdfId: '', points: [] },
  sideCalibration: { id: '', pdfId: '', points: [] },
};
const initial: Region[] = [
  base,
  { ...base, id: 'b', name: 'Deck B', xMin: 8, xMax: 18 },
  { ...base, id: 'c', name: 'Deck C', zMin: 5, zMax: 10 },
  { ...base, id: 'd', name: 'Módulo separado', xMin: 24, xMax: 30, yMax: 8, zMax: 4 },
  { ...base, id: 'e', name: 'Sala interna', xMin: 2, xMax: 4, yMin: 2, yMax: 4, zMin: 1, zMax: 3 },
  { ...base, id: 'old', name: 'Deck arquivado', archived: true },
  { ...base, id: 'legacy', name: 'Região legada', zMax: undefined },
  { ...base, id: 'invalid', name: 'Limites invertidos', xMin: 20 },
];
export function Fixture() {
  const params = new URLSearchParams(location.search);
  const [regions, setRegions] = useState(
    params.has('empty') ? [] : params.has('invalid') ? initial.slice(-2) : initial,
  );
  return (
    <main className="mx-auto max-w-[1440px] p-4">
      <RegionMapPanel regions={regions} />
      <button
        className="button-secondary mt-4"
        onClick={() => setRegions(initial.filter((region) => region.id !== 'b'))}
      >
        Simular atualização das regiões
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
