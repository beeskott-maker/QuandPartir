import { createTclApi, parsePassages, TclApiError } from './tclApi';

const sample = {
  fields: ['id', 'ligne', 'direction', 'delaipassage', 'type', 'heurepassage'],
  values: [
    { id: 34152, ligne: 'T1', direction: 'Debourg', delaipassage: '8 min', type: 'T', heurepassage: '2026-10-25 14:11:00' },
    { id: 34152, ligne: 'T1', direction: 'IUT Feyssine', delaipassage: 'Proche', type: 'E', heurepassage: '2026-10-25 14:03:00' },
    { id: 34152, ligne: 'T2', direction: 'Perrache' },
  ],
};

describe('parsePassages', () => {
  it('convertit, filtre les lignes incomplètes et trie par heure', () => {
    const passages = parsePassages(sample);
    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({
      stopId: '34152',
      line: 'T1',
      direction: 'IUT Feyssine',
      delayLabel: 'Proche',
      realtime: true,
    });
    expect(passages[0].departure.getHours()).toBe(14);
    expect(passages[0].departure.getMinutes()).toBe(3);
    expect(passages[1].realtime).toBe(false);
  });

  it('rejette une réponse sans values', () => {
    expect(() => parsePassages({ error: 'x' })).toThrow(TclApiError);
  });
});

describe('createTclApi', () => {
  it('interroge le jeu de données filtré sur l’arrêt via le relais', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const api = createTclApi('/api/grandlyon/', fetchFn as unknown as typeof fetch);
    const passages = await api.getPassages('34152');
    expect(passages).toHaveLength(2);
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe('/api/grandlyon/tcl_sytral.tclpassagearret/all.json?field=id&value=34152&maxfeatures=100&start=1');
  });

  it('signale un accès refusé', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 401 }));
    const api = createTclApi('/api/grandlyon', fetchFn as unknown as typeof fetch);
    await expect(api.getPassages('1')).rejects.toMatchObject({ status: 401 });
  });
});
