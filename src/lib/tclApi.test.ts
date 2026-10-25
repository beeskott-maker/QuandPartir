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
  it('demande au relais la ligne et l’arrêt, et ne garde que cette ligne', async () => {
    const body = { values: [...sample.values, { id: 34152, ligne: 'T2', direction: 'Perrache', type: 'E', heurepassage: '2026-10-25 14:04:00' }] };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const api = createTclApi('https://api.test/', '/arrets.json', fetchFn as unknown as typeof fetch);
    const passages = await api.getPassages(['34152'], 'T1');
    expect(passages.map((p) => p.line)).toEqual(['T1', 'T1']);
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe('https://api.test/tcl_sytral.tclpassagearret/all.json?ligne=T1&field=id&value=34152');
  });

  it('signale un accès refusé', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 401 }));
    const api = createTclApi('https://api.test', '/arrets.json', fetchFn as unknown as typeof fetch);
    await expect(api.getPassages(['1'], 'T1')).rejects.toMatchObject({ status: 401 });
  });

  it('envoie tous les codes de l’arrêt au relais', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ values: [] }), { status: 200 }));
    const api = createTclApi('https://api.test', '/arrets.json', fetchFn as unknown as typeof fetch);
    await api.getPassages(['1', '2'], 'T1');
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(new URL(url).searchParams.get('value')).toBe('1,2');
  });

  it('lit les arrêts de la ligne dans le fichier généré', async () => {
    const stops = { lines: { T1: [{ name: 'Bellecour', ids: ['1', '2'] }] } };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(stops), { status: 200 }));
    const api = createTclApi('https://api.test', '/arrets.json', fetchFn as unknown as typeof fetch);
    expect(await api.getStops('T1')).toEqual(stops.lines.T1);
    expect(await api.getStops('T2')).toEqual([]);
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe('/arrets.json');
  });
});
