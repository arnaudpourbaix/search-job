import { Alert, Button, Center, Loader, Stack } from '@mantine/core'
import { Navigate, Route, Routes } from 'react-router'
import { useMe } from './auth.ts'
import { AppLayout } from './layout/AppLayout.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { OpportunitiesPage } from './pages/OpportunitiesPage.tsx'
import { OpportunityDetailPage } from './pages/OpportunityDetailPage.tsx'
import { CampaignsPage } from './pages/CampaignsPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ContactsPage } from './pages/ContactsPage.tsx'
import { CompaniesPage } from './pages/CompaniesPage.tsx'
import { PipelinePage } from './pages/PipelinePage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'

export default function App() {
  const { data: me, isPending, isError, error, refetch } = useMe()

  if (isPending) {
    return (
      <Center h="100dvh">
        <Loader />
      </Center>
    )
  }
  if (isError) {
    return (
      <Center h="100dvh" p="md">
        <Stack align="center">
          <Alert color="red" title="Serveur injoignable">
            {error.message}
          </Alert>
          <Button variant="default" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </Stack>
      </Center>
    )
  }
  // Sans session, seule la page de connexion est accessible.
  if (!me) {
    return (
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="login" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pistes" element={<OpportunitiesPage />} />
        <Route path="pistes/:id" element={<OpportunityDetailPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="entreprises" element={<CompaniesPage />} />
        <Route path="campagnes" element={<CampaignsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
