import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { BackupsPage } from './pages/BackupsPage';
import { AllPage, BakeriesPage, CafesPage } from './pages/BrowsePages';
import { FriendPage, FriendsPage } from './pages/FriendsPages';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PassportPage } from './pages/PassportPage';
import { TopPage } from './pages/TopPage';

// Estas vistas incluyen mapas: Leaflet se descarga solo cuando hace falta.
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));
const PlacePage = lazy(() => import('./pages/PlacePage').then((module) => ({ default: module.PlacePage })));
const FormPage = lazy(() => import('./pages/FormPage').then((module) => ({ default: module.FormPage })));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="todas" element={<AllPage />} />
        <Route path="top" element={<TopPage />} />
        <Route path="solo-cafeterias" element={<CafesPage />} />
        <Route path="solo-panaderias" element={<BakeriesPage />} />
        {/* La antigua sección ahora es un filtro; los enlaces guardados siguen funcionando. */}
        <Route path="con-comida" element={<Navigate to="/todas?food=true" replace />} />
        <Route path="pasaporte" element={<PassportPage />} />
        <Route path="mapa" element={<MapPage />} />
        <Route path="agregar" element={<FormPage />} />
        <Route path="lugar/:id" element={<PlacePage />} />
        <Route path="lugar/:id/editar" element={<FormPage />} />
        <Route path="amigos" element={<FriendsPage />} />
        <Route path="amigos/:id" element={<FriendPage />} />
        <Route path="respaldos" element={<BackupsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
