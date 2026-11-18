import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './layout/AppLayout.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { OpportunitiesPage } from './pages/OpportunitiesPage.tsx'
import { OpportunityDetailPage } from './pages/OpportunityDetailPage.tsx'
import { CampaignsPage } from './pages/CampaignsPage.tsx'
import { ContactsPage } from './pages/ContactsPage.tsx'
import { PipelinePage } from './pages/PipelinePage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pistes" element={<OpportunitiesPage />} />
        <Route path="pistes/:id" element={<OpportunityDetailPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="campagnes" element={<CampaignsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
