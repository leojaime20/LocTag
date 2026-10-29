import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import splashImage from './assets/splash.jpg';

const ProjectHomePage = lazy(() => import('./pages/ProjectHomePage'));
const TagLocatorPage = lazy(() => import('./pages/TagLocatorPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="Carregando LocTag">
      <img className="splash-image" src={splashImage} alt="LocTag" />
      <span className="sr-only">Carregando LocTag...</span>
    </div>
  );
}

export function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/" element={<ProjectHomePage />} />
        <Route path="/p/:projectId" element={<TagLocatorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:projectId" element={<AdminPage />} />
      </Routes>
    </Suspense>
  );
}
