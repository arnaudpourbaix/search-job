import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { formatDay } from '../common/dates.js';
import { stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateContactDto,
  ListContactsQuery,
  UpdateContactDto,
} from './contacts.dto.js';

const companyRef = { select: { id: true, name: true } } as const;

const contactInclude = {
  company: companyRef,
  opportunities: {
    orderBy: { createdAt: 'asc' },
    select: {
      opportunity: {
        select: {
          id: true,
          reference: true,
          title: true,
          stage: stageRef,
          company: companyRef,
          intermediary: companyRef,
          campaign: { select: { id: true, name: true } },
        },
      },
    },
  },
  interactions: {
    select: { date: true },
    orderBy: { date: 'desc' },
    take: 1,
  },
  _count: { select: { interactions: true, interviews: true } },
} satisfies Prisma.ContactInclude;

type ContactRow = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;

/** Carnet de contacts, partagé entre pistes et campagnes. */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListContactsQuery) {
    const where: Prisma.ContactWhereInput = {};
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { title: contains },
        { email: contains },
        { phone: contains },
        { company: { name: contains } },
      ];
    }
    const rows = await this.prisma.contact.findMany({
      where,
      include: contactInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((c) => this.format(c));
  }

  async create(dto: CreateContactDto) {
    return this.prisma.$transaction(async (tx) => {
      const companyId = await this.companyId(tx, dto.companyName);
      await this.assertUnique(tx, dto.name, companyId ?? null);
      const { id } = await tx.contact.create({
        data: { ...this.fields(dto), name: dto.name, companyId },
        select: { id: true },
      });
      return this.format(
        await tx.contact.findUniqueOrThrow({
          where: { id },
          include: contactInclude,
        }),
      );
    });
  }

  async update(id: number, dto: UpdateContactDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.contact.findUnique({ where: { id } });
      if (!current) throw new NotFoundException(`Contact ${id} introuvable`);
      const companyId = await this.companyId(tx, dto.companyName);
      if (dto.name !== undefined || companyId !== undefined) {
        await this.assertUnique(
          tx,
          dto.name ?? current.name,
          companyId === undefined ? current.companyId : companyId,
          id,
        );
      }
      await tx.contact.update({
        where: { id },
        data: { ...this.fields(dto), name: dto.name, companyId },
      });
      return this.format(
        await tx.contact.findUniqueOrThrow({
          where: { id },
          include: contactInclude,
        }),
      );
    });
  }

  /** Le contact disparaît des pistes ; les échanges restent, sans interlocuteur. */
  async remove(id: number) {
    await this.prisma.contact.delete({ where: { id } });
  }

  private fields(dto: UpdateContactDto) {
    return {
      title: dto.title,
      email: dto.email,
      phone: dto.phone,
      linkedin: dto.linkedin,
      notes: dto.notes,
    };
  }

  /** Société désignée par son nom (créée si inconnue) ; undefined = inchangée. */
  private async companyId(
    tx: Prisma.TransactionClient,
    name: string | null | undefined,
  ) {
    if (name === undefined || name === null) return name;
    const company = await tx.company.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    return company.id;
  }

  /** Évite les doublons : même nom (sans tenir compte de la casse) dans la même société. */
  private async assertUnique(
    tx: Prisma.TransactionClient,
    name: string,
    companyId: number | null,
    exceptId?: number,
  ) {
    const duplicate = await tx.contact.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        companyId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `${name} existe déjà dans le carnet${companyId ? ' pour cette société' : ''}.`,
      );
    }
  }

  private format(c: ContactRow) {
    return {
      id: c.id,
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      linkedin: c.linkedin,
      notes: c.notes,
      company: c.company,
      opportunities: c.opportunities.map((o) => o.opportunity),
      interactionCount: c._count.interactions,
      interviewCount: c._count.interviews,
      lastInteractionAt: c.interactions[0]
        ? formatDay(c.interactions[0].date)
        : null,
    };
  }
}
