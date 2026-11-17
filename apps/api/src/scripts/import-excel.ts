/**
 * Import de l'ancien fichier Excel de suivi dans la base.
 *
 *   npm run import:excel -w api -- [chemin.xlsx] [--reset]
 *
 * Par défaut lit « recherches.xlsx » à la racine du dépôt.
 * Refuse de s'exécuter si la base contient déjà des pistes, sauf avec --reset
 * (qui vide toutes les tables avant l'import).
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
    const existing = await prisma.opportunity.count();
    if (existing > 0 && !reset) {
      throw new Error(
        `La base contient déjà ${existing} piste(s). Relancer avec --reset pour tout remplacer.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      if (reset) {
        await tx.notification.deleteMany();
        await tx.action.deleteMany();
        await tx.interaction.deleteMany();
        await tx.opportunity.deleteMany();
        await tx.contact.deleteMany();
        await tx.company.deleteMany();
        await tx.tag.deleteMany();
        await tx.refList.deleteMany();
      }

      // Types d'intermédiaire : absents de l'Excel, valeurs par défaut.
      const intermediaryTypes = INTERMEDIARY_TYPES.map((value, order) => ({
        category: 'INTERMEDIARY_TYPE',
        value,
        order,
      }));
      for (const entry of [...lists, ...intermediaryTypes]) {
        await tx.refList.upsert({
          where: {
            category_value: { category: entry.category, value: entry.value },
          },
          create: entry,
          update: { order: entry.order },
        });
      }

      const companyId = async (name: string | null) => {
        if (!name) return null;
        const company = await tx.company.upsert({
          where: { name },
          create: { name },
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
            where: { name: o.contact.name, companyId: contactOwner },
          });
          contactId =
            found?.id ??
            (
              await tx.contact.create({
                data: { ...o.contact, companyId: contactOwner },
              })
            ).id;
        }

        await tx.opportunity.create({
          data: {
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
            stage: o.stage,
            url: o.url,
            notes: o.notes,
            companyId: companyIdValue,
            intermediaryId: intermediaryIdValue,
            intermediaryType: o.intermediaryType,
            contactId,
            tags: {
              connectOrCreate: o.tags.map((name) => ({
                where: { name },
                create: { name },
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

    const counts = {
      pistes: await prisma.opportunity.count(),
      sociétés: await prisma.company.count(),
      contacts: await prisma.contact.count(),
      tags: await prisma.tag.count(),
      échanges: await prisma.interaction.count(),
      actions: await prisma.action.count(),
      listes: await prisma.refList.count(),
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
