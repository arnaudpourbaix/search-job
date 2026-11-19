import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCompanyDto, UpdateCompanyDto } from './companies.dto.js';

const companyRef = { select: { id: true, name: true } } as const;

const opportunitySelect = {
  id: true,
  reference: true,
  title: true,
  stage: stageRef,
  company: companyRef,
  intermediary: companyRef,
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.OpportunitySelect;

const companyInclude = {
  contacts: {
    select: { id: true, name: true, title: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  },
  // Pistes où l'entreprise est le client, puis celles où elle est l'intermédiaire.
  opportunities: { select: opportunitySelect, orderBy: { createdAt: 'asc' } },
  intermediaryOpportunities: {
    select: opportunitySelect,
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CompanyInclude;

type CompanyRow = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

/** Entreprises : clients et intermédiaires, partagés entre pistes et contacts. */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number) {
    const rows = await this.prisma.company.findMany({
      where: { userId },
      include: companyInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((c) => this.format(c));
  }

  async create(userId: number, dto: CreateCompanyDto) {
    await this.assertUnique(userId, dto.name);
    const { id } = await this.prisma.company.create({
      data: { userId, name: dto.name, address: dto.address, notes: dto.notes },
      select: { id: true },
    });
    return this.get(id);
  }

  async update(userId: number, id: number, dto: UpdateCompanyDto) {
    const found = await this.prisma.company.count({ where: { id, userId } });
    if (!found) throw new NotFoundException(`Entreprise ${id} introuvable`);
    if (dto.name) await this.assertUnique(userId, dto.name, id);
    await this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address,
        notes: dto.notes,
      },
    });
    return this.get(id);
  }

  /** Contacts et pistes restent, sans entreprise. */
  async remove(userId: number, id: number) {
    const { count } = await this.prisma.company.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException(`Entreprise ${id} introuvable`);
  }

  private async get(id: number) {
    return this.format(
      await this.prisma.company.findUniqueOrThrow({
        where: { id },
        include: companyInclude,
      }),
    );
  }

  /** Évite les doublons, sans tenir compte de la casse (« Acme » / « ACME »). */
  private async assertUnique(userId: number, name: string, exceptId?: number) {
    const duplicate = await this.prisma.company.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { name: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `L'entreprise ${duplicate.name} existe déjà.`,
      );
    }
  }

  private format(c: CompanyRow) {
    return {
      id: c.id,
      name: c.name,
      address: c.address,
      notes: c.notes,
      contacts: c.contacts,
      opportunities: [
        ...c.opportunities.map((o) => ({ ...o, role: 'CLIENT' as const })),
        ...c.intermediaryOpportunities.map((o) => ({
          ...o,
          role: 'INTERMEDIARY' as const,
        })),
      ],
    };
  }
}
