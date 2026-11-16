import { Stage } from '../generated/prisma/enums.js';
import {
  mapRow,
  parseStack,
  parseStage,
  type RawRow,
} from './excel-mapping.js';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function row(overrides: Partial<RawRow> = {}): RawRow {
  return {
    label: 'Piste',
    company: null,
    client: null,
    contactName: null,
    email: null,
    phone: null,
    platform: null,
    contractType: null,
    title: null,
    stack: null,
    location: null,
    remoteDays: null,
    duration: null,
    salaryMin: null,
    salaryMax: null,
    tjm: null,
    stage: null,
    firstContact: null,
    lastContact: null,
    nextAction: null,
    nextActionDate: null,
    link: null,
    notes: null,
    ...overrides,
  };
}

describe('parseStage', () => {
  it('ignore accents et casse', () => {
    expect(parseStage('Échange recruteur')).toBe(Stage.RECRUITER_TALK);
    expect(parseStage('refusé')).toBe(Stage.REJECTED);
  });
  it('vaut « À contacter » si vide', () => {
    expect(parseStage(null)).toBe(Stage.TO_CONTACT);
  });
  it('rejette une étape inconnue', () => {
    expect(() => parseStage('Signé')).toThrow('Étape inconnue');
  });
});

describe('parseStack', () => {
  it('découpe et dédoublonne', () => {
    expect(parseStack('Java / Angular / NestJS / angular')).toEqual([
      'Java',
      'Angular',
      'NestJS',
    ]);
    expect(parseStack('Fullstack JS')).toEqual(['Fullstack JS']);
  });
});

describe('mapRow', () => {
  it('client renseigné : entreprise = client, intermédiaire = société', () => {
    const o = mapRow(
      row({ company: 'Tachyan', client: 'BPCE', contractType: 'Freelance' }),
    );
    expect(o.companyName).toBe('BPCE');
    expect(o.intermediaryName).toBe('Tachyan');
    expect(o.intermediaryType).toBe("Apporteur d'affaires");
  });

  it('cabinet de recrutement en CDI', () => {
    const o = mapRow(
      row({ company: 'Hunteo', client: 'Logosw', contractType: 'CDI' }),
    );
    expect(o.companyName).toBe('Logosw');
    expect(o.intermediaryName).toBe('Hunteo');
    expect(o.intermediaryType).toBe('Cabinet de recrutement');
  });

  it('« Direct » : pas d’intermédiaire', () => {
    const o = mapRow(row({ company: 'Direct', client: 'Engie' }));
    expect(o.companyName).toBe('Engie');
    expect(o.intermediaryName).toBeNull();
    expect(o.intermediaryType).toBeNull();
  });

  it('sans client en CDI : la société est l’entreprise', () => {
    const o = mapRow(row({ company: 'Cap Gémini', contractType: 'CDI' }));
    expect(o.companyName).toBe('Cap Gémini');
    expect(o.intermediaryName).toBeNull();
  });

  it('sans client en freelance (« ??? ») : entreprise inconnue', () => {
    const o = mapRow(
      row({ company: 'Edwyn', client: '???', contractType: 'Freelance' }),
    );
    expect(o.companyName).toBeNull();
    expect(o.intermediaryName).toBe('Edwyn');
  });

  it('« Piste » redondante ignorée, vraie référence conservée', () => {
    const redundant = mapRow(
      row({
        label: 'COLEVER  - La Poste',
        company: 'COLEVER ',
        client: 'La Poste',
      }),
    );
    expect(redundant.reference).toBeNull();

    const reference = mapRow(row({ label: 'BPCE_INFO01289', client: 'BPCE' }));
    expect(reference.reference).toBe('BPCE_INFO01289');
  });

  it('réduit les espaces multiples mais garde les retours à la ligne', () => {
    const o = mapRow(
      row({ label: 'REF  42', notes: 'via Neurones \nnégocier' }),
    );
    expect(o.reference).toBe('REF 42');
    expect(o.notes).toBe('via Neurones\nnégocier');
  });

  it('lit une fourchette de TJM dans les notes', () => {
    const o = mapRow(row({ tjm: 550, notes: '500-600' }));
    expect([o.tjmMin, o.tjmMax]).toEqual([500, 600]);
    expect(o.notes).toBeNull();
  });

  it('TJM unique sinon, notes conservées', () => {
    const o = mapRow(row({ tjm: 470, notes: 'Traitement en cours' }));
    expect([o.tjmMin, o.tjmMax]).toEqual([470, 470]);
    expect(o.notes).toBe('Traitement en cours');
  });

  it('hyperlien → url, texte du lien → notes', () => {
    const o = mapRow(
      row({
        link: { text: 'Annonce BPCE', hyperlink: 'https://example.com/job' },
      }),
    );
    expect(o.url).toBe('https://example.com/job');
    expect(o.notes).toBe('Annonce : Annonce BPCE');
  });

  it('texte libre sans lien → notes uniquement', () => {
    const o = mapRow(row({ link: 'Messages LinkedIn' }));
    expect(o.url).toBeNull();
    expect(o.notes).toBe('Annonce : Messages LinkedIn');
  });

  it('crée les échanges du journal à partir des dates de contact', () => {
    const o = mapRow(
      row({
        platform: 'LinkedIn',
        firstContact: day('2026-11-04'),
        lastContact: day('2026-11-13'),
      }),
    );
    expect(o.interactions).toEqual([
      {
        date: day('2026-11-04'),
        channel: 'LinkedIn',
        summary: 'Premier contact (import Excel)',
      },
      {
        date: day('2026-11-13'),
        channel: 'LinkedIn',
        summary: 'Dernier contact (import Excel)',
      },
    ]);
  });

  it('un seul échange si 1er et dernier contact identiques', () => {
    const o = mapRow(
      row({ firstContact: day('2026-11-09'), lastContact: day('2026-11-09') }),
    );
    expect(o.interactions).toHaveLength(1);
  });

  it('action marquée faite si la piste est clôturée', () => {
    const open = mapRow(
      row({ nextAction: 'Rappeler', stage: 'Dossier envoyé' }),
    );
    const closed = mapRow(row({ nextAction: 'Rappeler', stage: 'Refusé' }));
    expect(open.action?.done).toBe(false);
    expect(closed.action?.done).toBe(true);
  });
});
