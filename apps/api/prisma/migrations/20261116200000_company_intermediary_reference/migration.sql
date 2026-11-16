-- Entreprise / intermédiaire / référence d'annonce.
--
-- Avant : companyId = « Société / ESN », clientId = « Client final », label = nom libre unique.
-- Après : companyId = entreprise où l'on travaille, intermediaryId = intermédiaire éventuel,
--         reference = référence d'annonce (facultative), nom affiché calculé.
--
-- Conversion des données existantes :
--   - client renseigné      → entreprise = client, intermédiaire = ancienne société (si différente)
--   - sans client, freelance/portage → intermédiaire = ancienne société, entreprise inconnue
--   - sans client, autre contrat     → entreprise = ancienne société
--   - type d'intermédiaire  : « Cabinet de recrutement » en CDI, sinon « Apporteur d'affaires »
--   - label conservé comme référence sauf s'il ne fait que répéter les noms des sociétés

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Opportunity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reference" TEXT,
    "title" TEXT,
    "platform" TEXT,
    "contractType" TEXT,
    "location" TEXT,
    "remoteDays" INTEGER,
    "duration" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "tjmMin" INTEGER,
    "tjmMax" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'TO_CONTACT',
    "url" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" INTEGER,
    "intermediaryId" INTEGER,
    "intermediaryType" TEXT,
    "contactId" INTEGER,
    CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_intermediaryId_fkey" FOREIGN KEY ("intermediaryId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

WITH src AS (
    SELECT
        o.*,
        o."contractType" IN ('Freelance', 'Portage') AS freelance,
        (SELECT name FROM "Company" WHERE id = o."companyId") AS societe,
        (SELECT name FROM "Company" WHERE id = o."clientId") AS client
    FROM "Opportunity" o
),
mapped AS (
    SELECT
        src.*,
        CASE
            WHEN "clientId" IS NOT NULL THEN "clientId"
            WHEN freelance THEN NULL
            ELSE "companyId"
        END AS new_company,
        CASE
            WHEN "clientId" IS NOT NULL AND "companyId" IS NOT "clientId" THEN "companyId"
            WHEN "clientId" IS NULL AND freelance THEN "companyId"
            ELSE NULL
        END AS new_intermediary,
        -- Nom « compacté » : minuscules, sans espaces ni séparateurs.
        lower(replace(replace(replace(replace(label, ' ', ''), '-', ''), '–', ''), '_', '')) AS c_label,
        lower(replace(replace(replace(replace(coalesce(societe, ''), ' ', ''), '-', ''), '–', ''), '_', '')) AS c_societe,
        lower(replace(replace(replace(replace(coalesce(client, ''), ' ', ''), '-', ''), '–', ''), '_', '')) AS c_client
    FROM src
)
INSERT INTO "new_Opportunity" (
    "id", "reference", "title", "platform", "contractType", "location", "remoteDays", "duration",
    "salaryMin", "salaryMax", "tjmMin", "tjmMax", "stage", "url", "notes", "createdAt", "updatedAt",
    "companyId", "intermediaryId", "intermediaryType", "contactId"
)
SELECT
    "id",
    CASE
        WHEN c_label IN (c_societe, c_client, c_societe || c_client, c_client || c_societe) THEN NULL
        ELSE label
    END,
    "title", "platform", "contractType", "location", "remoteDays", "duration",
    "salaryMin", "salaryMax", "tjmMin", "tjmMax", "stage", "url", "notes", "createdAt", "updatedAt",
    new_company,
    new_intermediary,
    CASE
        WHEN new_intermediary IS NULL THEN NULL
        WHEN "contractType" = 'CDI' THEN 'Cabinet de recrutement'
        ELSE 'Apporteur d''affaires'
    END,
    "contactId"
FROM mapped;

DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_companyId_idx" ON "Opportunity"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Nouvelle liste modifiable : types d'intermédiaire.
INSERT OR IGNORE INTO "RefList" ("category", "value", "order") VALUES
    ('INTERMEDIARY_TYPE', 'Apporteur d''affaires', 0),
    ('INTERMEDIARY_TYPE', 'Société de portage', 1),
    ('INTERMEDIARY_TYPE', 'Cabinet de recrutement', 2);
