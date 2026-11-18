/**
 * Import de l'ancien fichier Excel de suivi dans la base.
 *
 *   npm run import:excel -w api -- [chemin.xlsx] --user=adresse@gmail.com [--reset] [--campaign=Nom]
 *
 * Par défaut lit « recherches.xlsx » à la racine du dépôt. Les données sont importées
 * dans le compte de l'utilisateur désigné (il doit s'être connecté une première fois ;
 * --user peut être omis s'il n'y a qu'un compte). Les pistes sont rattachées à la
 * campagne nommée (créée si besoin, « Mission janvier 2027 » par défaut).
 * Refuse de s'exécuter si ce compte contient déjà des pistes, sauf avec --reset
 * (qui vide les données de ce compte, et seulement les siennes, avant l'import).
 */
import { config as loadEnv } from 'dotenv';
import ExcelJS from 'exceljs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  INTERMEDIARY_TYPES,
  mapRow,
  normalize,
  type RawRow,
} from '../import/excel-mapping.js';
import { today } from '../common/dates.js';
import { DEFAULT_STAGES, type StageCode } from '../common/stages.js';
import { API_ROOT } from '../paths.js';
import { createPrismaAdapter } from '../prisma/adapter.js';

/** En-tête Excel (normalisé) → champ de RawRow. */
const COLUMNS: Record<string, keyof RawRow> = {
  piste: 'label',
  'societe / esn': 'company',
  'client final': 'client',
  contact: 'contactName',
  email: 'email',
  telephone: 'phone',
  plateforme: 'platform',
  type: 'contractType',
  poste: 'title',
  stack: 'stack',
  lieu: 'location',
  'remote (j/sem)': 'remoteDays',
  duree: 'duration',
  'salaire min (€/an)': 'salaryMin',
  'salaire max (€/an)': 'salaryMax',
  'tjm (€/j)': 'tjm',
  etape: 'stage',
  '1er contact': 'firstContact',
  'dernier contact': 'lastContact',
  'prochaine action': 'nextAction',
  'date action': 'nextActionDate',
  'lien annonce': 'link',
  notes: 'notes',
};

/** Colonne de l'onglet « Listes » → catégorie de RefList. */
const LIST_CATEGORIES: Record<string, string> = {
  plateforme: 'PLATFORM',
  type: 'CONTRACT_TYPE',
  canal: 'CHANNEL',
};

/** Valeur exploitable d'une cellule exceljs (texte riche, formule, lien…). */
function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value !== 'object') return value;
  if ('richText' in value) return value.richText.map((r) => r.text).join('');
  if ('hyperlink' in value) return value; // { text, hyperlink }
  if ('formula' in value || 'sharedFormula' in value)
    return value.result ?? null;
  if ('error' in value) return null;
  return value;
}

function headerMap(sheet: ExcelJS.Worksheet): Map<number, string> {
  const map = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cellValue(cell.value);
    if (header) map.set(col, normalize(String(header)));
  });
  return map;
}

function readOpportunities(sheet: ExcelJS.Worksheet): RawRow[] {
  const headers = headerMap(sheet);
  const fields = new Map<number, keyof RawRow>();
  for (const [col, header] of headers) {
    const field = COLUMNS[header];
    if (field) fields.set(col, field);
  }
  const missing = Object.values(COLUMNS).filter(
    (f) => ![...fields.values()].includes(f),
  );
  if (missing.length) {
    throw new Error(
      `Colonnes manquantes dans « Pistes » : ${missing.join(', ')}`,
    );
  }

  const rows: RawRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const raw = {} as Record<keyof RawRow, unknown>;
    for (const [col, field] of fields)
      raw[field] = cellValue(row.getCell(col).value);
    if (raw.label !== null && String(raw.label).trim() !== '') {
      rows.push(raw as RawRow);
    }
  });
  return rows;
}

function readLists(sheet: ExcelJS.Worksheet | undefined) {
  const entries: { category: string; value: string; order: number }[] = [];
  if (!sheet) return entries;
  for (const [col, header] of headerMap(sheet)) {
    const category = LIST_CATEGORIES[header];
    if (!category) continue;
    let order = 0;
    sheet.getColumn(col).eachCell((cell, rowIndex) => {
      if (rowIndex === 1) return;
      const value = cellValue(cell.value);
      if (value !== null && String(value).trim()) {
        entries.push({ category, value: String(value).trim(), order: order++ });
      }
    });
  }
  return entries;
}

async function main() {
  loadEnv({ path: join(API_ROOT, '.env'), quiet: true });
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const userEmail = args
    .find((a) => a.startsWith('--user='))
    ?.slice('--user='.length)
    .trim()
    .toLowerCase();
  const campaignName =
    args
      .find((a) => a.startsWith('--campaign='))
      ?.slice('--campaign='.length)
      .trim() || 'Mission janvier 2027';
  const file = resolve(
    API_ROOT,
    args.find((a) => !a.startsWith('--')) ?? '../../recherches.xlsx',
  );
  if (!existsSync(file)) throw new Error(`Fichier introuvable : ${file}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets.find((s) => normalize(s.name) === 'pistes');
  if (!sheet) throw new Error('Onglet « Pistes » introuvable');
  const lists = readLists(
    workbook.worksheets.find((s) => normalize(s.name) === 'listes'),
  );
  const opportunities = readOpportunities(sheet).map(mapRow);

  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

  try {
    const users = await prisma.user.findMany({
      where: userEmail ? { email: userEmail } : {},
      select: { id: true, email: true },
      take: 2,
    });
    if (users.length !== 1) {
      throw new Error(
        userEmail
          ? `Aucun compte pour ${userEmail} : se connecter une première fois au site.`
          : 'Plusieurs comptes (ou aucun) : préciser --user=adresse.',
      );
    }
    const userId = users[0].id;
    const mine = { userId };

    const existing = await prisma.opportunity.count({ where: mine });
    if (existing > 0 && !reset) {
      throw new Error(
        `Le compte ${users[0].email} contient déjà ${existing} piste(s). Relancer avec --reset pour les remplacer.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      if (reset) {
        // Pistes d'abord (échanges, actions, entretiens, notifications suivent).
        await tx.opportunity.deleteMany({ where: mine });
        await tx.contact.deleteMany({ where: mine });
        await tx.company.deleteMany({ where: mine });
        await tx.tag.deleteMany({ where: mine });
        await tx.refList.deleteMany({ where: mine });
        await tx.campaign.deleteMany({ where: mine });
        await tx.pipelineStage.deleteMany({ where: mine });
      }

      // Étapes d'origine : créées si absentes (base vide ou --reset), sans écraser
      // celles qui existent. Les codes de l'Excel pointent vers elles par libellé.
      const stageIds = new Map<StageCode, number>();
      for (const [order, stage] of DEFAULT_STAGES.entries()) {
        const { id } = await tx.pipelineStage.upsert({
          where: { userId_label: { userId, label: stage.label } },
          create: {
            userId,
            label: stage.label,
            color: stage.color,
            kind: stage.kind,
            order,
          },
          update: {},
        });
        stageIds.set(stage.code, id);
      }

      // Campagne démarrée au plus ancien échange importé.
      const firstContact = opportunities
        .flatMap((o) => o.interactions.map((i) => i.date))
        .reduce<Date | null>((min, d) => (!min || d < min ? d : min), null);
      const campaign = await tx.campaign.upsert({
        where: { userId_name: { userId, name: campaignName } },
        create: {
          userId,
          name: campaignName,
          startDate: firstContact ?? today(),
        },
        update: {},
      });

      // Types d'intermédiaire : absents de l'Excel, valeurs par défaut.
      const intermediaryTypes = INTERMEDIARY_TYPES.map((value, order) => ({
        category: 'INTERMEDIARY_TYPE',
        value,
        order,
      }));
      for (const entry of [...lists, ...intermediaryTypes]) {
        await tx.refList.upsert({
          where: {
            userId_category_value: {
              userId,
              category: entry.category,
              value: entry.value,
            },
          },
          create: { ...entry, userId },
          update: { order: entry.order },
        });
      }

      const companyId = async (name: string | null) => {
        if (!name) return null;
        const company = await tx.company.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name },
          update: {},
        });
        return company.id;
      };

      for (const o of opportunities) {
        const companyIdValue = await companyId(o.companyName);
        const intermediaryIdValue = await companyId(o.intermediaryName);

        // Le contact appartient à l'intermédiaire s'il y en a un.
        const contactOwner = intermediaryIdValue ?? companyIdValue;
        let contactId: number | null = null;
        if (o.contact) {
          const found = await tx.contact.findFirst({
            where: { userId, name: o.contact.name, companyId: contactOwner },
          });
          contactId =
            found?.id ??
            (
              await tx.contact.create({
                data: { ...o.contact, userId, companyId: contactOwner },
              })
            ).id;
        }

        await tx.opportunity.create({
          data: {
            userId,
            reference: o.reference,
            title: o.title,
            platform: o.platform,
            contractType: o.contractType,
            location: o.location,
            remoteDays: o.remoteDays,
            duration: o.duration,
            salaryMin: o.salaryMin,
            salaryMax: o.salaryMax,
            tjmMin: o.tjmMin,
            tjmMax: o.tjmMax,
            stageId: stageIds.get(o.stage)!,
            url: o.url,
            notes: o.notes,
            campaignId: campaign.id,
            companyId: companyIdValue,
            intermediaryId: intermediaryIdValue,
            intermediaryType: o.intermediaryType,
            contacts: contactId ? { create: { contactId } } : undefined,
            tags: {
              connectOrCreate: o.tags.map((name) => ({
                where: { userId_name: { userId, name } },
                create: { userId, name },
              })),
            },
            interactions: { create: o.interactions },
            actions: o.action
              ? {
                  create: {
                    label: o.action.label,
                    dueDate: o.action.dueDate,
                    doneAt: o.action.done ? new Date() : null,
                  },
                }
              : undefined,
          },
        });
      }
    });

    const ofMine = { where: mine };
    const viaOpportunity = { where: { opportunity: mine } };
    const counts = {
      campagnes: await prisma.campaign.count(ofMine),
      étapes: await prisma.pipelineStage.count(ofMine),
      pistes: await prisma.opportunity.count(ofMine),
      sociétés: await prisma.company.count(ofMine),
      contacts: await prisma.contact.count(ofMine),
      tags: await prisma.tag.count(ofMine),
      échanges: await prisma.interaction.count(viaOpportunity),
      actions: await prisma.action.count(viaOpportunity),
      listes: await prisma.refList.count(ofMine),
    };
    console.log(`Import terminé depuis ${file}`);
    console.table(counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
