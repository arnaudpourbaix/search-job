import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './layout/AppLayout.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { OpportunitiesPage } from './pages/OpportunitiesPage.tsx'
import { PipelinePage } from './pages/PipelinePage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pistes" element={<OpportunitiesPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
