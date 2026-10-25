import worker, { type Env } from './index';

const env: Env = {
  GRANDLYON_USER: 'demo',
  GRANDLYON_PASSWORD: 'secret',
  ALLOWED_ORIGINS: 'https://beeskott-maker.github.io,http://localhost:5173',
  GRANDLYON_BASE_URL: 'https://upstream.test/rdata',
};

const PASSAGES = 'https://api.test/tcl_sytral.tclpassagearret/all.json';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{"values":[]}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function get(url: string, origin?: string): Promise<Response> {
  return worker.fetch(new Request(url, { headers: origin ? { Origin: origin } : {} }), env);
}

it('relaie la requête avec l’authentification et les en-têtes CORS', async () => {
  const response = await get(`${PASSAGES}?field=id&value=101&evil=1`, 'https://beeskott-maker.github.io');
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://beeskott-maker.github.io');
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://upstream.test/rdata/tcl_sytral.tclpassagearret/all.json?field=id&value=101&maxfeatures=5000&start=1');
  expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('demo:secret')}`);
});

it('sert une même requête depuis le cache', async () => {
  await get(`${PASSAGES}?field=id&value=202`);
  await get(`${PASSAGES}?field=id&value=202`);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('refuse les origines inconnues et les autres jeux de données', async () => {
  expect((await get(PASSAGES, 'https://evil.example')).status).toBe(403);
  expect((await get('https://api.test/autre.jeu/all.json')).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('relaie un accès refusé par data.grandlyon.com', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
  expect((await get(`${PASSAGES}?field=id&value=303`)).status).toBe(401);
});

it('répond au pré-vol CORS', async () => {
  const response = await worker.fetch(
    new Request(PASSAGES, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
    env,
  );
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
});
