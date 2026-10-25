import worker, { clearCache, type Env } from './index';

const env: Env = {
  GRANDLYON_USER: 'demo',
  GRANDLYON_PASSWORD: 'secret',
  ALLOWED_ORIGINS: 'https://beeskott-maker.github.io,http://localhost:5173',
  GRANDLYON_BASE_URL: 'https://upstream.test/rdata',
};

const PASSAGES = 'https://api.test/tcl_sytral.tclpassagearret/all.json';
const UPSTREAM_BODY = {
  values: [
    { id: 101, ligne: 'T1', direction: 'IUT Feyssine', heurepassage: '2026-10-25 14:05:00' },
    { id: 102, ligne: 'T1', direction: 'Debourg', heurepassage: '2026-10-25 14:07:00' },
    { id: 101, ligne: 'T2', direction: 'Perrache', heurepassage: '2026-10-25 14:06:00' },
  ],
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearCache();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(UPSTREAM_BODY), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function get(url: string, origin?: string): Promise<Response> {
  return worker.fetch(new Request(url, { headers: origin ? { Origin: origin } : {} }), env);
}

it('interroge Grand Lyon sur la T1 par défaut, avec l’authentification', async () => {
  const response = await get(`${PASSAGES}?field=ligne&value=T2`, 'https://beeskott-maker.github.io');
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://beeskott-maker.github.io');
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://upstream.test/rdata/tcl_sytral.tclpassagearret/all.json?field=ligne&value=T1&maxfeatures=5000&start=1');
  expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('demo:secret')}`);
  const body = await response.json();
  expect(body.values.map((v: { ligne: string }) => v.ligne)).toEqual(['T1', 'T1']);
});

it('interroge Grand Lyon sur la ligne demandée, et elle seule', async () => {
  const body = await (await get(`${PASSAGES}?ligne=t2`)).json();
  const [url] = fetchMock.mock.calls[0] as [string];
  expect(url).toContain('field=ligne&value=T2');
  expect(body.values).toEqual([UPSTREAM_BODY.values[2]]);
});

it('refuse une ligne invalide sans appeler Grand Lyon', async () => {
  expect((await get(`${PASSAGES}?ligne=T1%26field%3Did`)).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('accepte plusieurs codes d’arrêt', async () => {
  const body = await (await get(`${PASSAGES}?field=id&value=101,102`)).json();
  expect(body.values).toEqual([UPSTREAM_BODY.values[0], UPSTREAM_BODY.values[1]]);
});

it('filtre par arrêt et sert toutes les requêtes depuis un seul appel en cache', async () => {
  const first = await (await get(`${PASSAGES}?field=id&value=101`)).json();
  const second = await (await get(`${PASSAGES}?field=id&value=102`)).json();
  expect(first.values).toEqual([UPSTREAM_BODY.values[0]]);
  expect(second.values).toEqual([UPSTREAM_BODY.values[1]]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('refuse les origines inconnues et les autres jeux de données', async () => {
  expect((await get(PASSAGES, 'https://evil.example')).status).toBe(403);
  expect((await get('https://api.test/tcl_sytral.tclarret/all.json')).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('relaie un accès refusé par data.grandlyon.com', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
  expect((await get(`${PASSAGES}?field=id&value=101`)).status).toBe(401);
});

it('répond au pré-vol CORS', async () => {
  const response = await worker.fetch(
    new Request(PASSAGES, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
    env,
  );
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
});

it('limite les appels par adresse IP', async () => {
  const call = (ip: string) =>
    worker.fetch(new Request(`${PASSAGES}?ligne=T1`, { headers: { 'CF-Connecting-IP': ip } }), env);
  for (let i = 0; i < 30; i++) expect((await call('1.2.3.4')).status).toBe(200);
  const refused = await call('1.2.3.4');
  expect(refused.status).toBe(429);
  expect(refused.headers.get('Retry-After')).toBe('60');
  // Les autres adresses ne sont pas concernées.
  expect((await call('5.6.7.8')).status).toBe(200);
  // Grand Lyon n'a été appelé qu'une fois grâce au cache.
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

describe('trajet à pied', () => {
  const ROUTE = 'https://api.test/itineraire';
  const routeEnv: Env = { ...env, IGN_ROUTE_URL: 'https://ign.test/itineraire' };
  const route = (query: string) => worker.fetch(new Request(`${ROUTE}?${query}`), routeEnv);

  it('demande à l’IGN un trajet piéton et renvoie durée et distance', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ duration: 412.3, distance: 498.1, geometry: {} }), { status: 200 }));
    const response = await route('start=4.832012345,45.7578&end=4.8357,45.7606');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ duration: 412.3, distance: 498.1 });
    const url = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(url.origin + url.pathname).toBe('https://ign.test/itineraire');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      resource: 'bdtopo-osrm',
      profile: 'pedestrian',
      start: '4.83201,45.7578',
      end: '4.8357,45.7606',
      timeUnit: 'second',
      distanceUnit: 'meter',
    });
  });

  it('refuse des points invalides ou trop éloignés sans appeler l’IGN', async () => {
    expect((await route('start=abc&end=4.8,45.7')).status).toBe(400);
    expect((await route('start=4.83,45.75')).status).toBe(400);
    expect((await route('start=4.83,45.75&end=2.35,48.85')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signale une réponse de l’IGN inutilisable', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'x' }), { status: 200 }));
    expect((await route('start=4.832,45.7578&end=4.8357,45.7606')).status).toBe(502);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect((await route('start=4.832,45.7578&end=4.8357,45.7606')).status).toBe(502);
  });
});
