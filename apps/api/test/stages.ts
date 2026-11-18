import type { Http } from './auth.js';

export type StageRow = {
  id: number;
  label: string;
  color: string;
  kind: string;
  order: number;
  usage: number;
};

/** Identifiants des étapes de l'utilisateur, par libellé (étapes de départ). */
export async function stageIds(http: Http): Promise<Record<string, number>> {
  const res = await http().get('/settings/stages').expect(200);
  return Object.fromEntries(
    (res.body as StageRow[]).map((s) => [s.label, s.id]),
  );
}
