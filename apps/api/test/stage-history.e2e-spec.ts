import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { stageIds } from './stages.js';

type Change = {
  id: number;
  fromLabel: string | null;
  toLabel: string;
  auto: boolean;
  at: string;
};
type Detail = {
  stageChanges: Change[];
  lastContactAt: string | null;
};

const steps = (d: Detail) =>
  d.stageChanges.map((c) => [c.fromLabel, c.toLabel, c.auto]);

describe('Historique des étapes (e2e)', () => {
  let app: INestApplication<App>;
  let http: Http;
  let campaignId: number;
  let stages: Record<string, number>;

  const create = async (companyName: string, stageLabel?: string) =>
    (
      (
        await http()
          .post('/opportunities')
          .send({
            companyName,
            campaignId,
            ...(stageLabel ? { stageId: stages[stageLabel] } : {}),
          })
          .expect(201)
      ).body as { id: number }
    ).id;
  const detail = async (id: number) =>
    (await http().get(`/opportunities/${id}`).expect(200)).body as Detail;
  const setStage = (id: number, label: string) =>
    http()
      .patch(`/opportunities/${id}`)
      .send({ stageId: stages[label] })
      .expect(200);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(
      new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    // Compte dédié : la suppression d'étape ne gêne pas les autres specs.
    http = await signIn(app);
    stages = await stageIds(http);
    campaignId = (
      (
        await http()
          .post('/campaigns')
          .send({ name: 'Historique ' + Date.now() })
          .expect(201)
      ).body as { id: number }
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('trace la création et chaque changement manuel, sans compter de contact', async () => {
    const id = await create('Histo');
    expect(steps(await detail(id))).toEqual([[null, 'À contacter', false]]);

    await setStage(id, 'Dossier envoyé');
    // Même étape : rien de nouveau. Autre champ : rien non plus.
    await setStage(id, 'Dossier envoyé');
    await http()
      .patch(`/opportunities/${id}`)
      .send({ location: 'Lyon' })
      .expect(200);

    const d = await detail(id);
    expect(steps(d)).toEqual([
      ['À contacter', 'Dossier envoyé', false],
      [null, 'À contacter', false],
    ]);
    expect(d.lastContactAt).toBeNull();
  });

  it("trace le passage automatique à l'étape des entretiens", async () => {
    const id = await create('Histo auto', 'Dossier envoyé');
    await http()
      .post(`/opportunities/${id}/interviews`)
      .send({ type: 'Entretien RH' })
      .expect(201);
    expect(steps(await detail(id))[0]).toEqual([
      'Dossier envoyé',
      'Entretiens',
      true,
    ]);
  });

  it("garde le libellé d'origine quand une étape est renommée ou supprimée", async () => {
    const extra = (
      (
        await http()
          .post('/settings/stages')
          .send({ label: 'Relance client' })
          .expect(201)
      ).body as { id: number }
    ).id;
    const id = await create('Histo suppression');
    await http()
      .patch(`/opportunities/${id}`)
      .send({ stageId: extra })
      .expect(200);
    await http()
      .patch('/settings/stages/' + extra)
      .send({ label: 'Relance' })
      .expect(200);
    await http()
      .delete(`/settings/stages/${extra}?replaceWith=${stages['Proposition']}`)
      .expect(200);

    expect(steps(await detail(id))).toEqual([
      ['Relance', 'Proposition', true],
      ['À contacter', 'Relance client', false],
      [null, 'À contacter', false],
    ]);
  });
});
