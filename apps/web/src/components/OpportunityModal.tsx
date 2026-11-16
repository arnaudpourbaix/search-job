import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useNavigate } from 'react-router'
import { opportunityName } from '../format.ts'
import { useCreateOpportunity, useUpdateOpportunity } from '../queries.ts'
import type { OpportunityDetail } from '../types.ts'
import { OpportunityForm } from './OpportunityForm.tsx'

type Props = {
  opened: boolean
  onClose: () => void
  /** Piste à modifier ; absente = création. */
  opportunity?: OpportunityDetail
}

export function OpportunityModal({ opened, onClose, opportunity }: Props) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const navigate = useNavigate()
  const create = useCreateOpportunity()
  const update = useUpdateOpportunity(opportunity?.id ?? 0)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={opportunity ? `Modifier « ${opportunityName(opportunity)} »` : 'Nouvelle piste'}
      size="xl"
      fullScreen={mobile}
    >
      <OpportunityForm
        // Réinitialise le formulaire à chaque ouverture.
        key={opened ? 'open' : 'closed'}
        opportunity={opportunity}
        submitting={create.isPending || update.isPending}
        onCancel={onClose}
        onSubmit={(input) => {
          if (opportunity) {
            update.mutate(input, {
              onSuccess: () => {
                notifications.show({ color: 'green', message: 'Piste enregistrée' })
                onClose()
              },
            })
          } else {
            create.mutate(input, {
              onSuccess: (created) => {
                notifications.show({ color: 'green', message: 'Piste créée' })
                onClose()
                void navigate(`/pistes/${created.id}`)
              },
            })
          }
        }}
      />
    </Modal>
  )
}
