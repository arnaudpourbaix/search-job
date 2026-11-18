import { modals } from '@mantine/modals'
import { ContactForm } from './components/ContactForm.tsx'
import type { Contact, ContactInput } from './types.ts'

/** Ouvre la fiche d'un contact (création ou modification) dans une fenêtre. */
export function openContactModal({
  contact,
  initial,
  onSaved,
}: {
  contact?: Contact
  initial?: Partial<ContactInput>
  onSaved?: (c: Contact) => void
}) {
  const id = modals.open({
    title: contact ? `Modifier ${contact.name}` : 'Nouveau contact',
    size: 'lg',
    children: (
      <ContactForm
        contact={contact}
        initial={initial}
        onCancel={() => modals.close(id)}
        onSaved={(c) => {
          modals.close(id)
          onSaved?.(c)
        }}
      />
    ),
  })
}
