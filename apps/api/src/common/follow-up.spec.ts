import { addDays, parseDay } from './dates.js';
import { followUp, type FollowUpInput } from './follow-up.js';

const day = parseDay('2026-11-25');
const at = (n: number) => addDays(day, n);
/** Échange répondu / relance restée sans réponse, `n` jours avant ou après aujourd'hui. */
const reply = (n: number) => ({ date: at(n), answered: true });
const noReply = (n: number) => ({ date: at(n), answered: false });

const base: FollowUpInput = {
  closed: false,
  contacts: [],
  upcomingInterview: false,
  followUpAt: null,
  followUpSetOn: null,
  responseDueAt: null,
  responseDueSetOn: null,
};
const status = (o: Partial<FollowUpInput>) =>
  followUp({ ...base, ...o }, day, { staleDays: 14, silenceDays: 30 });

describe('followUp', () => {
  it('sans contact ni date : rien à suivre', () => {
    expect(status({}).status).toBe('NONE');
  });

  it('calcule la relance : dernier contact + délai', () => {
    expect(status({ contacts: [reply(-10)] })).toEqual({
      status: 'PLANNED',
      date: at(4),
      planned: false,
      reason: null,
    });
    expect(status({ contacts: [reply(-14)] })).toMatchObject({
      status: 'DUE',
      date: day,
    });
  });

  it('une relance sans réponse repousse la suivante', () => {
    expect(status({ contacts: [reply(-25), noReply(-5)] })).toMatchObject({
      status: 'PLANNED',
      date: at(9),
    });
  });

  it('une date saisie remplace le calcul, plus tôt ou plus tard', () => {
    const set = { followUpSetOn: at(-10), contacts: [reply(-10)] };
    expect(status({ ...set, followUpAt: at(-1) })).toMatchObject({
      status: 'DUE',
      date: at(-1),
      planned: true,
    });
    expect(status({ ...set, followUpAt: at(20) })).toMatchObject({
      status: 'PLANNED',
      date: at(20),
    });
  });

  it('un contact après la saisie, même sans réponse, rend la date de relance caduque', () => {
    const set = { followUpAt: at(20), followUpSetOn: at(-10) };
    expect(status({ ...set, contacts: [reply(-5)] })).toMatchObject({
      status: 'PLANNED',
      date: at(9),
      planned: false,
    });
    expect(
      status({ ...set, contacts: [reply(-10), noReply(-5)] }),
    ).toMatchObject({ date: at(9), planned: false });
  });

  it('délai de réponse : en attente, puis sans réponse', () => {
    const due = { contacts: [reply(-20)], responseDueSetOn: at(-20) };
    expect(status({ ...due, responseDueAt: at(8) })).toMatchObject({
      status: 'AWAITING',
      date: at(8),
    });
    expect(status({ ...due, responseDueAt: day })).toMatchObject({
      status: 'NO_RESPONSE',
      date: day,
      reason: 'DEADLINE',
    });
    // Une relance sans réponse ne l'annule pas…
    expect(
      status({
        ...due,
        responseDueAt: day,
        contacts: [reply(-20), noReply(-3)],
      }).status,
    ).toBe('NO_RESPONSE');
    // …une réponse, si.
    expect(
      status({ ...due, responseDueAt: at(-1), contacts: [reply(-3)] }).status,
    ).toBe('PLANNED');
  });

  it('une relance prévue avant l’échéance reste valable', () => {
    expect(
      status({
        contacts: [reply(-20)],
        responseDueAt: at(8),
        responseDueSetOn: at(-20),
        followUpAt: at(-1),
        followUpSetOn: at(-20),
      }),
    ).toMatchObject({ status: 'DUE', date: at(-1) });
  });

  it('long silence malgré les relances : clôture proposée', () => {
    expect(
      status({ contacts: [reply(-35), noReply(-20), noReply(-6)] }),
    ).toMatchObject({
      status: 'NO_RESPONSE',
      date: at(-35),
      reason: 'SILENCE',
    });
    // Sans relance faite, on relance d'abord.
    expect(status({ contacts: [reply(-35)] }).status).toBe('DUE');
    // Jamais de réponse : le silence court depuis le premier contact.
    expect(status({ contacts: [noReply(-40), noReply(-10)] })).toMatchObject({
      status: 'NO_RESPONSE',
      date: at(-40),
    });
    // « Toujours en attente » : une relance repoussée l'emporte jusqu'à sa date.
    expect(
      status({
        contacts: [reply(-35), noReply(-20)],
        followUpAt: at(7),
        followUpSetOn: day,
      }).status,
    ).toBe('PLANNED');
  });

  it('entretien prévu ou piste close : pas de relance', () => {
    const contacts = [reply(-60), noReply(-30)];
    expect(status({ contacts, upcomingInterview: true }).status).toBe(
      'INTERVIEW',
    );
    expect(status({ contacts, closed: true }).status).toBe('NONE');
  });
});
