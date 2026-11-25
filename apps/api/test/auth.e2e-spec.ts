import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { AuthConfig } from '../src/auth/auth.config.js';
import {
  INITIAL_ACCOUNT_EMAIL,
  UsersService,
} from '../src/auth/users.service.js';
import { addDays, formatDay, today } from '../src/common/dates.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { client, createUser, type Http, signIn } from './auth.js';

type Detail = {
  id: number;
  interactions: { id: number }[];
  actions: { id: number }[];
  interviews: { id: number }[];
  contacts: { id: number }[];
};

describe('Connexion et cloisonnement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let anonymous: ReturnType<typeof client>;

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
    prisma = app.get(PrismaService);
    anonymous = client(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('accès sans connexion', () => {
    it('ne laisse publique que la santé, sans aucune donnée', async () => {
      const res = await anonymous.get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it.each([
      '/auth/me',
      '/opportunities',
      '/opportunities/1',
      '/contacts',
      '/campaigns',
      '/dashboard',
      '/notifications',
      '/settings/lists',
      '/settings/stages',
      '/ref-lists',
      '/companies',
      '/tags',
    ])('refuse GET %s (401)', async (url) => {
      await anonymous.get(url).expect(401);
    });

    it('refuse les modifications (401)', async () => {
      await anonymous
        .post('/opportunities')
        .send({ companyName: 'X' })
        .expect(401);
      await anonymous.patch('/interactions/1').send({}).expect(401);
      await anonymous.delete('/contacts/1').expect(401);
      await anonymous.post('/notifications/read-all').expect(401);
    });

    it('refuse un cookie de session inventé', async () => {
      await client(app, 'sid=nimportequoi').get('/opportunities').expect(401);
    });
  });

  describe('session', () => {
    it("donne l'utilisateur connecté", async () => {
      const { user, cookie } = await createUser(app, 'me');
      const res = await client(app, cookie).get('/auth/me').expect(200);
      expect(res.body).toEqual({
        id: user.id,
        email: user.email,
        name: null,
        picture: null,
        staleDays: 14,
        silenceDays: 30,
        homeAddress: null,
      });
    });

    it('la déconnexion supprime la session côté serveur', async () => {
      const { cookie } = await createUser(app, 'logout');
      const http = client(app, cookie);
      await http.post('/auth/logout').expect(204);
      await http.get('/auth/me').expect(401);
    });

    it('refuse une session expirée', async () => {
      const { user, cookie } = await createUser(app, 'expired');
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await client(app, cookie).get('/auth/me').expect(401);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it('prolonge une session utilisée à moins de la moitié de sa durée', async () => {
      const { user, cookie } = await createUser(app, 'renew');
      const soon = new Date(Date.now() + 86_400_000);
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { expiresAt: soon },
      });
      const res = await client(app, cookie).get('/auth/me').expect(200);
      expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(session.expiresAt.getTime()).toBeGreaterThan(
        soon.getTime() + 20 * 86_400_000,
      );
    });

    it("ne stocke que l'empreinte du jeton", async () => {
      const { user, cookie } = await createUser(app, 'hash');
      const token = cookie.split('=')[1];
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(session.id).not.toBe(token);
      expect(session.id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('refuse une modification venant d’un autre site (CSRF)', async () => {
      const { cookie } = await createUser(app, 'csrf');
      const http = client(app, cookie);
      await http
        .post('/campaigns')
        .set('Origin', 'https://site-malveillant.example')
        .send({ name: 'Piège' })
        .expect(403);
      await http
        .post('/campaigns')
        .set('Origin', app.get(AuthConfig).appUrl.origin)
        .send({ name: 'Légitime' })
        .expect(201);
    });

    it('renvoie vers la connexion si le retour de Google arrive sans connexion en cours', async () => {
      const res = await anonymous
        .get('/auth/google/callback?code=x&state=y')
        .expect(302);
      expect(res.headers.location).toMatch(/\/login\?error=expired$/);
    });
  });

  describe('comptes Google', () => {
    const config = (owner: string) =>
      ({ isOwner: (e: string) => e === owner }) as unknown as AuthConfig;
    const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    it('crée un compte, avec ses étapes et listes, à la première connexion', async () => {
      const users = new UsersService(prisma, config('personne@test.local'));
      const id = unique();
      const user = await users.signIn({
        sub: 'sub-' + id,
        email: `Nouveau-${id}@Test.local`,
        name: 'Nouveau',
        picture: null,
      });
      expect(user.email).toBe(`nouveau-${id}@test.local`);
      expect(
        await prisma.pipelineStage.count({ where: { userId: user.id } }),
      ).toBeGreaterThan(0);

      // Reconnexion : même compte, profil mis à jour.
      const again = await users.signIn({
        sub: 'sub-' + id,
        email: `nouveau-${id}@test.local`,
        name: 'Renommé',
        picture: null,
      });
      expect(again.id).toBe(user.id);
      expect(again.name).toBe('Renommé');
    });

    it('refuse une adresse déjà liée à un autre compte Google', async () => {
      const users = new UsersService(prisma, config('personne@test.local'));
      const id = unique();
      const email = `double-${id}@test.local`;
      await users.signIn({ sub: 'a-' + id, email, name: null, picture: null });
      await expect(
        users.signIn({ sub: 'b-' + id, email, name: null, picture: null }),
      ).rejects.toThrow(/autre compte Google/);
    });

    it('ne laisse que le propriétaire reprendre le compte initial', async () => {
      const initial = await prisma.user.findFirst({
        where: { email: INITIAL_ACCOUNT_EMAIL, googleSub: null },
      });
      const id = unique();
      const owner = `proprietaire-${id}@test.local`;
      const users = new UsersService(prisma, config(owner));

      // Une autre adresse autorisée obtient un compte neuf.
      const other = await users.signIn({
        sub: 'autre-' + id,
        email: `autre-${id}@test.local`,
        name: null,
        picture: null,
      });
      if (initial) expect(other.id).not.toBe(initial.id);

      // Le compte initial (créé par la migration) n'existe qu'une fois : base remise à
      // zéro par `npm run test:e2e`, il est alors repris par le propriétaire.
      if (!initial) return;
      const claimed = await users.signIn({
        sub: 'owner-' + id,
        email: owner,
        name: null,
        picture: null,
      });
      expect(claimed.id).toBe(initial.id);
      expect(claimed.email).toBe(owner);
    });
  });

  describe('cloisonnement entre utilisateurs', () => {
    let alice: Http;
    let bob: Http;
    const a = {} as {
      campaign: number;
      stage: number;
      listItem: number;
      contact: number;
      opportunity: number;
      interaction: number;
      action: number;
      interview: number;
      notification: number;
    };
    let bobCampaign: number;
    let bobOpportunity: number;

    beforeAll(async () => {
      alice = await signIn(app, 'alice');
      bob = await signIn(app, 'bob');

      a.campaign = (
        await alice()
          .post('/campaigns')
          .send({ name: 'Campagne Alice' })
          .expect(201)
      ).body.id;
      a.stage = (
        await alice()
          .post('/settings/stages')
          .send({ label: 'Étape Alice' })
          .expect(201)
      ).body.id;
      a.listItem = (
        await alice()
          .post('/settings/lists/PLATFORM')
          .send({ value: 'Plateforme Alice' })
          .expect(201)
      ).body.id;
      a.contact = (
        await alice()
          .post('/contacts')
          .send({ name: 'Contact Alice', companyName: 'Société Alice' })
          .expect(201)
      ).body.id;
      const o = (
        await alice()
          .post('/opportunities')
          .send({
            campaignId: a.campaign,
            companyName: 'Société Alice',
            tags: ['TagAlice'],
            contactIds: [a.contact],
          })
          .expect(201)
      ).body as Detail;
      a.opportunity = o.id;
      a.interaction = (
        (
          await alice()
            .post(`/opportunities/${o.id}/interactions`)
            .send({ date: '2026-11-10', summary: 'Secret' })
            .expect(201)
        ).body as Detail
      ).interactions[0].id;
      a.action = (
        (
          await alice()
            .post(`/opportunities/${o.id}/actions`)
            .send({
              label: 'Relancer',
              dueDate: formatDay(addDays(today(), -1)),
            })
            .expect(201)
        ).body as Detail
      ).actions[0].id;
      a.interview = (
        (
          await alice()
            .post(`/opportunities/${o.id}/interviews`)
            .send({ type: 'Entretien RH' })
            .expect(201)
        ).body as Detail
      ).interviews[0].id;
      const notifications = (await alice().get('/notifications').expect(200))
        .body as { items: { id: number }[] };
      a.notification = notifications.items[0].id;

      bobCampaign = (
        await bob()
          .post('/campaigns')
          .send({ name: 'Campagne Bob' })
          .expect(201)
      ).body.id;
      bobOpportunity = (
        await bob()
          .post('/opportunities')
          .send({ campaignId: bobCampaign, companyName: 'Société Bob' })
          .expect(201)
      ).body.id;
    });

    it("ne montre aucune donnée d'Alice dans les listes de Bob", async () => {
      const opportunities = (await bob().get('/opportunities').expect(200))
        .body as { id: number }[];
      expect(opportunities.map((o) => o.id)).toEqual([bobOpportunity]);

      const contacts = (await bob().get('/contacts').expect(200)).body as {
        id: number;
      }[];
      expect(contacts).toEqual([]);

      const campaigns = (await bob().get('/campaigns').expect(200)).body as {
        id: number;
      }[];
      expect(campaigns.map((c) => c.id)).toEqual([bobCampaign]);

      const companies = (await bob().get('/companies').expect(200)).body as {
        name: string;
      }[];
      expect(companies.map((c) => c.name)).toEqual(['Société Bob']);
      expect((await bob().get('/tags').expect(200)).body).toEqual([]);

      const stages = (await bob().get('/settings/stages').expect(200)).body as {
        id: number;
      }[];
      expect(stages.map((s) => s.id)).not.toContain(a.stage);

      const refLists = (await bob().get('/ref-lists').expect(200)).body as {
        PLATFORM: string[];
      };
      expect(refLists.PLATFORM).not.toContain('Plateforme Alice');

      const notifications = (await bob().get('/notifications').expect(200))
        .body as { items: unknown[] };
      expect(notifications.items).toEqual([]);

      const dashboard = (await bob().get('/dashboard').expect(200)).body as {
        kpis: { total: number };
        todo: unknown[];
        recent: unknown[];
      };
      expect(dashboard.kpis.total).toBe(1);
      expect(dashboard.todo).toEqual([]);
      expect(dashboard.recent).toEqual([]);
      await bob().get(`/dashboard?campaignId=${a.campaign}`).expect(200);
    });

    it("traite les pistes d'Alice comme inexistantes pour Bob (404)", async () => {
      const id = a.opportunity;
      await bob().get(`/opportunities/${id}`).expect(404);
      await bob()
        .patch(`/opportunities/${id}`)
        .send({ title: 'Piraté' })
        .expect(404);
      await bob()
        .post(`/opportunities/${id}/interactions`)
        .send({ date: '2026-11-10', summary: 'x' })
        .expect(404);
      await bob()
        .post(`/opportunities/${id}/actions`)
        .send({ label: 'x' })
        .expect(404);
      await bob()
        .post(`/opportunities/${id}/interviews`)
        .send({ type: 'Test' })
        .expect(404);
      await bob()
        .put(`/opportunities/${id}/interviews/order`)
        .send({ ids: [a.interview] })
        .expect(404);
      await bob().delete(`/opportunities/${id}`).expect(404);
    });

    it("refuse à Bob de modifier le journal, les actions et entretiens d'Alice", async () => {
      await bob()
        .patch(`/interactions/${a.interaction}`)
        .send({ summary: 'Piraté' })
        .expect(404);
      await bob().delete(`/interactions/${a.interaction}`).expect(404);
      await bob()
        .patch(`/actions/${a.action}`)
        .send({ done: true })
        .expect(404);
      await bob().delete(`/actions/${a.action}`).expect(404);
      await bob()
        .patch(`/interviews/${a.interview}`)
        .send({ notes: 'Piraté' })
        .expect(404);
      await bob().delete(`/interviews/${a.interview}`).expect(404);
      await bob()
        .patch(`/notifications/${a.notification}`)
        .send({ read: true })
        .expect(404);
      await bob().post('/notifications/read-all').expect(204);
    });

    it("refuse à Bob de modifier le carnet, les campagnes et paramètres d'Alice", async () => {
      await bob()
        .patch(`/contacts/${a.contact}`)
        .send({ title: 'Piraté' })
        .expect(404);
      await bob().delete(`/contacts/${a.contact}`).expect(404);
      await bob()
        .patch(`/campaigns/${a.campaign}`)
        .send({ name: 'Piraté' })
        .expect(404);
      await bob().delete(`/campaigns/${a.campaign}`).expect(404);
      await bob()
        .patch(`/settings/stages/${a.stage}`)
        .send({ label: 'Piraté' })
        .expect(404);
      await bob().delete(`/settings/stages/${a.stage}`).expect(404);
      await bob()
        .patch(`/settings/lists/items/${a.listItem}`)
        .send({ value: 'Piraté' })
        .expect(404);
      await bob().delete(`/settings/lists/items/${a.listItem}`).expect(404);

      const own = (await bob().get('/settings/stages').expect(200)).body as {
        id: number;
      }[];
      await bob()
        .put('/settings/stages/order')
        .send({ ids: [...own.map((s) => s.id), a.stage] })
        .expect(400);
    });

    it("refuse à Bob d'utiliser les identifiants d'Alice dans ses propres données", async () => {
      await bob()
        .post('/opportunities')
        .send({ campaignId: a.campaign, companyName: 'X' })
        .expect(400);
      await bob()
        .post('/opportunities')
        .send({ campaignId: bobCampaign, stageId: a.stage, companyName: 'X' })
        .expect(400);
      await bob()
        .post('/opportunities')
        .send({
          campaignId: bobCampaign,
          companyName: 'X',
          contactIds: [a.contact],
        })
        .expect(400);
      await bob()
        .patch(`/opportunities/${bobOpportunity}`)
        .send({ campaignId: a.campaign })
        .expect(400);
      await bob()
        .patch(`/opportunities/${bobOpportunity}`)
        .send({ stageId: a.stage })
        .expect(400);
      await bob()
        .post(`/opportunities/${bobOpportunity}/interactions`)
        .send({ date: '2026-11-10', summary: 'x', contactId: a.contact })
        .expect(400);
      await bob()
        .post(`/opportunities/${bobOpportunity}/interviews`)
        .send({ type: 'Test', contactIds: [a.contact] })
        .expect(400);
    });

    it("laisse les noms se répéter d'un utilisateur à l'autre", async () => {
      await bob()
        .post('/campaigns')
        .send({ name: 'Campagne Alice' })
        .expect(201);
      await bob()
        .post('/settings/stages')
        .send({ label: 'Étape Alice' })
        .expect(201);
      const contact = (
        await bob()
          .post('/contacts')
          .send({ name: 'Contact Alice', companyName: 'Société Alice' })
          .expect(201)
      ).body as { company: { id: number } };
      const aliceContact = (
        (await alice().get('/contacts').expect(200)).body as {
          company: { id: number };
        }[]
      )[0];
      expect(contact.company.id).not.toBe(aliceContact.company.id);
    });

    it("garde les données d'Alice intactes", async () => {
      const o = (
        await alice().get(`/opportunities/${a.opportunity}`).expect(200)
      ).body as Detail & { title: string | null };
      expect(o.title).toBeNull();
      expect(o.interactions).toHaveLength(1);
      expect(o.actions).toHaveLength(1);
      expect(o.interviews).toHaveLength(1);
      expect(o.contacts.map((c) => c.id)).toEqual([a.contact]);
      const notifications = (await alice().get('/notifications').expect(200))
        .body as { unread: number };
      expect(notifications.unread).toBeGreaterThan(0);
    });
  });
});
