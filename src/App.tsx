import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const TagLocatorPage = lazy(() => import('./pages/TagLocatorPage'));

export function App() {
  return (
    <Suspense fallback={<div className="app-loading">Carregando LocTag...</div>}>
      <Routes>
        <Route path="/" element={<TagLocatorPage />} />
      </Routes>
    </Suspense>
  );
}
