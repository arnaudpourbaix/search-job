import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

/** Ce qu'il faut pour afficher un contact (fiche piste, journal, sélecteurs). */
export const contactRef = {
  select: {
    id: true,
    name: true,
    title: true,
    email: true,
    phone: true,
    company: { select: { id: true, name: true } },
  },
} as const satisfies Prisma.ContactDefaultArgs;

/** Contacts d'une piste, dans l'ordre où ils ont été ajoutés. */
export const opportunityContactsInclude = {
  select: { contact: contactRef },
  orderBy: [{ createdAt: 'asc' }, { contactId: 'asc' }],
} satisfies Prisma.Opportunity$contactsArgs;

/** Interlocuteurs d'un entretien, dans l'ordre où ils ont été ajoutés. */
export const interviewContactsInclude = {
  select: { contact: contactRef },
  orderBy: [{ createdAt: 'asc' }, { contactId: 'asc' }],
} satisfies Prisma.Interview$contactsArgs;

/** Vérifie que tous les contacts désignés existent dans le carnet. */
export async function assertContacts(
  db: Prisma.TransactionClient,
  ids: number[],
) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const found = await db.contact.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new BadRequestException('Contact introuvable dans le carnet.');
  }
  return unique;
}

/** Ajoute des contacts à une piste (sans doublon ni changement d'ordre). */
export async function linkContacts(
  db: Prisma.TransactionClient,
  opportunityId: number,
  contactIds: number[],
) {
  if (!contactIds.length) return;
  await db.opportunityContact.createMany({
    data: contactIds.map((contactId) => ({ opportunityId, contactId })),
    skipDuplicates: true,
  });
}
