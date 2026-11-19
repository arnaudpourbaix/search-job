import { modals } from '@mantine/modals'
import { CompanyForm } from './components/CompanyForm.tsx'
import type { Company } from './types.ts'

/** Ouvre la fiche d'une entreprise (création ou modification) dans une fenêtre. */
export function openCompanyModal(company?: Company) {
  const id = modals.open({
    title: company ? `Modifier ${company.name}` : 'Nouvelle entreprise',
    children: (
      <CompanyForm
        company={company}
        onCancel={() => modals.close(id)}
        onSaved={() => modals.close(id)}
      />
    ),
  })
}
