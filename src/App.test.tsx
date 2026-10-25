import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { createDemoApi } from './lib/demoApi';
import type { Passage, PassagesApi } from './lib/types';

function mockPosition(result: { lat: number; lon: number } | { denied: true }) {
  const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
    if ('denied' in result) {
      failure?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    } else {
      success({ coords: { latitude: result.lat, longitude: result.lon } } as GeolocationPosition);
    }
  });
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
}

async function chooseLine(line: string) {
  await screen.findByRole('option', { name: line });
  fireEvent.change(screen.getByLabelText('Ligne'), { target: { value: line } });
}

async function chooseStop(name: string) {
  await screen.findByRole('option', { name });
  fireEvent.change(screen.getByLabelText('Arrêt'), { target: { value: name } });
}

const widget = () => screen.getByRole('region', { name: 'Prochain départ' });
const walk = () => screen.getByRole('group', { name: 'Temps pour rejoindre l’arrêt' });

function clickWalk(button: 'plus' | 'moins', times = 1) {
  const name = button === 'plus' ? 'Une minute de plus' : 'Une minute de moins';
  for (let i = 0; i < times; i++) fireEvent.click(within(walk()).getByRole('button', { name }));
}

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(navigator, 'geolocation');
});

it('impose de choisir une ligne, puis un arrêt, sans liste des passages', async () => {
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  expect(screen.queryByRole('heading', { name: 'QuandPartir' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Ligne')).toBeRequired();
  expect(screen.getByLabelText('Arrêt')).toBeDisabled();
  expect(await within(widget()).findByText('Choisis une ligne ci-dessous.')).toBeInTheDocument();

  await chooseLine('T2');
  expect(widget()).toHaveTextContent('Choisis un arrêt du T2 ci-dessous.');
  await chooseStop('Arrêt B');
  expect(await within(widget()).findByText(/\d+:\d{2} minutes/)).toBeInTheDocument();
  expect(widget()).toHaveTextContent(/Prochain T2 direction Direction . à \d{2}:\d{2}:\d{2}/);
  expect(getPassages).toHaveBeenCalledWith(['3', '4'], 'T2');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('retient la ligne, l’arrêt et le temps de trajet', async () => {
  localStorage.setItem('quandpartir.ligne', 'T1');
  localStorage.setItem('quandpartir.arret', 'Arrêt C');
  localStorage.setItem('quandpartir.trajet', '4');
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  expect(await within(widget()).findByText(/\d+:\d{2} minutes/)).toBeInTheDocument();
  expect(getPassages).toHaveBeenCalledWith(['5', '6'], 'T1');
  expect(walk()).toHaveTextContent('4 min');
});

it('redemande l’arrêt quand la ligne change', async () => {
  render(<App api={createDemoApi()} />);
  await chooseLine('T1');
  await chooseStop('Arrêt A');
  await chooseLine('T2');
  expect(screen.getByLabelText('Arrêt')).toHaveValue('');
  expect(localStorage.getItem('quandpartir.arret')).toBe('');
});

describe('temps de trajet', () => {
  const now = new Date('2026-10-25T13:00:00');
  const passage = (time: string, direction: string): Passage => ({
    stopId: '1',
    line: 'T1',
    direction,
    departure: new Date(`2026-10-25T${time}`),
    delayLabel: '',
    realtime: true,
  });
  const api: PassagesApi = {
    demo: false,
    getLines: async () => ['T1'],
    getStops: async () => [{ name: 'Bellecour', ids: ['1'] }],
    getPassages: async () => [passage('13:03:10', 'Part-Dieu'), passage('13:10:00', 'IUT Feyssine')],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    localStorage.setItem('quandpartir.ligne', 'T1');
    localStorage.setItem('quandpartir.arret', 'Bellecour');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('compte à rebours jusqu’au passage quand on est déjà à l’arrêt', async () => {
    render(<App api={api} />);
    expect(await within(widget()).findByText('3:10 minutes')).toBeInTheDocument();
    expect(widget()).toHaveTextContent('Prochain T1 direction Part-Dieu à 13:03:10');
  });

  it('retranche le temps de trajet et saute les trams qu’on ne peut plus attraper', async () => {
    render(<App api={api} />);
    await within(widget()).findByText('3:10 minutes');
    clickWalk('plus', 2);
    expect(walk()).toHaveTextContent('2 min');
    expect(await within(widget()).findByText('1:10 minutes')).toBeInTheDocument();
    clickWalk('plus', 3);
    expect(await within(widget()).findByText('5:00 minutes')).toBeInTheDocument();
    expect(widget()).toHaveTextContent('Prochain T1 direction IUT Feyssine à 13:10:00');
    expect(localStorage.getItem('quandpartir.trajet')).toBe('5');
  });

  it('signale qu’aucun tram n’est atteignable', async () => {
    render(<App api={api} />);
    await within(widget()).findByText('3:10 minutes');
    clickWalk('plus', 15);
    expect(await within(widget()).findByText('Aucun T1 atteignable avec 15 min de trajet.')).toBeInTheDocument();
  });
});

it('borne le temps de trajet entre 0 et 30 minutes', async () => {
  render(<App api={createDemoApi()} />);
  const minus = within(walk()).getByRole('button', { name: 'Une minute de moins' });
  const plus = within(walk()).getByRole('button', { name: 'Une minute de plus' });
  expect(walk()).toHaveTextContent('0 min');
  expect(minus).toBeDisabled();
  clickWalk('plus', 30);
  expect(walk()).toHaveTextContent('30 min');
  expect(plus).toBeDisabled();
  clickWalk('moins');
  expect(walk()).toHaveTextContent('29 min');
});

it('affiche l’erreur de l’API', async () => {
  const api: PassagesApi = {
    demo: false,
    getLines: async () => ['T1'],
    getStops: async () => [{ name: 'Arrêt A', ids: ['1'] }],
    getPassages: () => Promise.reject(new Error('Accès refusé')),
  };
  render(<App api={api} />);
  await chooseLine('T1');
  await chooseStop('Arrêt A');
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
});

it('sélectionne l’arrêt le plus proche de la position', async () => {
  mockPosition({ lat: 45.7486, lon: 4.8256 });
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  await chooseLine('T1');
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByText(/Arrêt le plus proche de toi, à 10 m/)).toBeInTheDocument();
  expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt B');
  expect(getPassages).toHaveBeenCalledWith(['3', '4'], 'T1');
});

it('explique un refus de localisation', async () => {
  mockPosition({ denied: true });
  render(<App api={createDemoApi()} />);
  await chooseLine('T1');
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Localisation refusée');
});
