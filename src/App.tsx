import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const ProjectHomePage = lazy(() => import('./pages/ProjectHomePage'));
const TagLocatorPage = lazy(() => import('./pages/TagLocatorPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

export function App() {
  return (
    <Suspense fallback={<div className="app-loading">Carregando LocTag...</div>}>
      <Routes>
        <Route path="/" element={<ProjectHomePage />} />
        <Route path="/p/:projectId" element={<TagLocatorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:projectId" element={<AdminPage />} />
      </Routes>
    </Suspense>
  );
}
