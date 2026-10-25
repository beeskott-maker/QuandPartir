import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/** Déplie la section « Réglages » si elle est repliée (ses champs ne sont alors pas affichés). */
async function openSettings() {
  const toggle = await screen.findByRole('button', { name: /(Déplier|Replier) les réglages/ });
  if (toggle.getAttribute('aria-label') === 'Déplier les réglages') fireEvent.click(toggle);
  await screen.findByLabelText('Ligne');
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
  const getLinePassages = vi.spyOn(api, 'getLinePassages');
  render(<App api={api} />);
  await openSettings();
  expect(screen.queryByRole('heading', { name: 'QuandPartir' })).not.toBeInTheDocument();
  // Ligne obligatoire : rien n'est choisi d'office et l'arrêt attend la ligne.
  expect(await within(screen.getByLabelText('Ligne')).findByText('Choisir une ligne')).toBeDisabled();
  expect(screen.getByLabelText('Arrêt')).toBeDisabled();
  expect(await within(widget()).findByText('Choisis une ligne ci-dessous.')).toBeInTheDocument();

  await chooseLine('T2');
  expect(widget()).toHaveTextContent('Choisis un arrêt du tram T2 ci-dessous.');
  await chooseStop('Arrêt B');
  expect(await within(widget()).findByText(/\d+:\d{2} min/)).toBeInTheDocument();
  expect(widget()).toHaveTextContent(/Prochain tram T2 direction Direction . à \d{2}:\d{2}:\d{2}/);
  // Un seul appel, pour la ligne : l'arrêt est filtré dans l'appli.
  expect(getLinePassages).toHaveBeenCalledTimes(1);
  expect(getLinePassages).toHaveBeenCalledWith('T2');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

describe('section Réglages', () => {
  it('est repliée, avec son seul titre, quand tout est réglé', async () => {
    localStorage.setItem('quandpartir.ligne', 'T1');
    localStorage.setItem('quandpartir.direction', 'Direction A');
    localStorage.setItem('quandpartir.arret', 'Arrêt C');
    render(<App api={createDemoApi()} />);
    expect(await within(widget()).findByText(/\d+:\d{2} min/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déplier les réglages' })).toBeInTheDocument();
    expect(screen.getByText('Réglages')).toBeInTheDocument();
    // Ni champ ni résumé des valeurs.
    expect(screen.queryByLabelText('Ligne')).not.toBeInTheDocument();
    expect(screen.queryByText('Arrêt C')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Déplier les réglages' }));
    expect(await screen.findByLabelText('Arrêt')).toHaveValue('Arrêt C');
  });

  it('se déplie d’office sans ligne choisie, et reste ouverte une fois complétée', async () => {
    render(<App api={createDemoApi()} />);
    expect(await screen.findByRole('button', { name: 'Replier les réglages' })).toBeInTheDocument();
    await chooseLine('T1');
    await chooseStop('Arrêt B');
    expect(await within(widget()).findByText(/\d+:\d{2} min/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replier les réglages' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replier les réglages' }));
    expect(screen.queryByLabelText('Ligne')).not.toBeInTheDocument();
  });

  it('se déplie d’office quand l’arrêt retenu n’existe plus', async () => {
    localStorage.setItem('quandpartir.ligne', 'T1');
    localStorage.setItem('quandpartir.arret', 'Arrêt disparu');
    render(<App api={createDemoApi()} />);
    expect(await screen.findByRole('button', { name: 'Replier les réglages' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ligne')).toHaveValue('T1');
  });
});

it('propose toutes les lignes : métro, puis tram, puis bus', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
  await screen.findByRole('option', { name: 'T1' });
  const groups = within(screen.getByLabelText('Ligne')).getAllByRole('group');
  expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Métro et funiculaire', 'Tram', 'Bus']);
  expect(within(groups[1]).getAllByRole('option').map((o) => o.textContent)).toEqual(['T1', 'T2']);
  await chooseLine('C3');
  expect(widget()).toHaveTextContent('Choisis un arrêt du bus C3 ci-dessous.');
  await chooseLine('A');
  expect(widget()).toHaveTextContent('Choisis un arrêt du métro A ci-dessous.');
  await chooseStop('Arrêt A');
  expect(await within(widget()).findByText(/^Prochain métro A direction Direction . à/)).toBeInTheDocument();
});

it('retient la ligne, l’arrêt et le temps de trajet', async () => {
  localStorage.setItem('quandpartir.ligne', 'T1');
  localStorage.setItem('quandpartir.arret', 'Arrêt C');
  localStorage.setItem('quandpartir.trajet', '4');
  render(<App api={createDemoApi()} />);
  await openSettings();
  expect(await within(widget()).findByText(/\d+:\d{2} min/)).toBeInTheDocument();
  expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt C');
  expect(walk()).toHaveTextContent('4 min');
});

it('propose la direction sous la ligne et choisit d’office la première', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
  const labels = screen.getAllByText(/^(Ligne|Direction|Arrêt)$/).map((el) => el.textContent);
  expect(labels).toEqual(['Ligne', 'Direction', 'Arrêt']);
  expect(screen.getByLabelText('Direction')).toBeDisabled();
  await chooseLine('T1');
  expect(await screen.findByRole('option', { name: 'Direction B' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Direction')).toHaveValue('Direction A'));
  expect(screen.queryByText('Toutes les directions')).not.toBeInTheDocument();
  expect(localStorage.getItem('quandpartir.direction')).toBe('Direction A');
});

it('bascule sur l’autre direction', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
  const swap = screen.getByRole('button', { name: 'Basculer sur l’autre direction' });
  expect(swap).toBeDisabled();
  await chooseLine('T1');
  await waitFor(() => expect(screen.getByLabelText('Direction')).toHaveValue('Direction A'));
  fireEvent.click(swap);
  expect(screen.getByLabelText('Direction')).toHaveValue('Direction B');
  expect(localStorage.getItem('quandpartir.direction')).toBe('Direction B');
  fireEvent.click(swap);
  expect(screen.getByLabelText('Direction')).toHaveValue('Direction A');
});

it('range les arrêts dans l’ordre du parcours, du terminus opposé jusqu’à la direction choisie', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
  await chooseLine('T1');
  await screen.findByRole('option', { name: 'Direction A' });
  const stopNames = () => within(screen.getByLabelText('Arrêt')).getAllByRole('option').map((o) => o.textContent);
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'Direction A' } });
  await waitFor(() => expect(stopNames()).toEqual(['Arrêt B', 'Arrêt C', 'Arrêt A']));
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'Direction B' } });
  await waitFor(() => expect(stopNames()).toEqual(['Arrêt A', 'Arrêt C', 'Arrêt B']));
});

it('redemande la direction et l’arrêt quand la ligne change', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
  await chooseLine('T1');
  await screen.findByRole('option', { name: 'Direction A' });
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'Direction A' } });
  await chooseStop('Arrêt A');
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'Direction B' } });
  await chooseLine('T2');
  // La direction repart sur la première de la nouvelle ligne, l'arrêt est à rechoisir.
  await waitFor(() => expect(screen.getByLabelText('Direction')).toHaveValue('Direction A'));
  expect(await within(widget()).findByText('Choisis un arrêt du tram T2 ci-dessous.')).toBeInTheDocument();
  expect(localStorage.getItem('quandpartir.direction')).toBe('Direction A');
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
    getLinePassages: async () => [
      passage('13:03:10', 'Part-Dieu'),
      passage('13:10:00', 'IUT Feyssine'),
      passage('13:12:00', 'Part-Dieu'),
    ],
    getStops: async () => [{ name: 'Bellecour', ids: ['1'] }],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    localStorage.setItem('quandpartir.ligne', 'T1');
    localStorage.setItem('quandpartir.direction', 'Part-Dieu');
    localStorage.setItem('quandpartir.arret', 'Bellecour');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('compte à rebours jusqu’au passage quand on est déjà à l’arrêt', async () => {
    render(<App api={api} />);
    await openSettings();
    expect(await within(widget()).findByText('3:10 min')).toBeInTheDocument();
    expect(widget()).toHaveTextContent('Prochain tram T1 direction Part-Dieu à 13:03:10');
    // « Prochain tram T1 » sur une ligne, la direction sur la suivante.
    expect(widget().querySelector('.widget-detail br')).not.toBeNull();
  });

  it('retranche le temps de trajet et saute les trams qu’on ne peut plus attraper', async () => {
    render(<App api={api} />);
    await openSettings();
    await within(widget()).findByText('3:10 min');
    clickWalk('plus', 2);
    expect(walk()).toHaveTextContent('2 min');
    expect(await within(widget()).findByText('1:10 min')).toBeInTheDocument();
    clickWalk('plus', 3);
    // Le tram de 13:03 est manqué : le suivant vers Part-Dieu passe à 13:12.
    expect(await within(widget()).findByText('7:00 min')).toBeInTheDocument();
    expect(widget()).toHaveTextContent('Prochain tram T1 direction Part-Dieu à 13:12:00');
    expect(localStorage.getItem('quandpartir.trajet')).toBe('5');
  });

  it('ne compte que les trams de la direction choisie', async () => {
    render(<App api={api} />);
    await openSettings();
    await within(widget()).findByText('3:10 min');
    await screen.findByRole('option', { name: 'IUT Feyssine' });
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'IUT Feyssine' } });
    expect(await within(widget()).findByText('10:00 min')).toBeInTheDocument();
    expect(widget()).toHaveTextContent('Prochain tram T1 direction IUT Feyssine à 13:10:00');
    expect(localStorage.getItem('quandpartir.direction')).toBe('IUT Feyssine');
  });

  it('signale qu’aucun tram n’est annoncé dans la direction choisie', async () => {
    localStorage.setItem('quandpartir.direction', 'Debourg');
    render(<App api={api} />);
    await openSettings();
    // La direction retenue reste proposée même si aucun passage ne l’annonce.
    expect(screen.getByLabelText('Direction')).toHaveValue('Debourg');
    expect(await within(widget()).findByText('Aucun tram T1 direction Debourg annoncé à cet arrêt.')).toBeInTheDocument();
  });

  it('signale qu’aucun tram n’est atteignable', async () => {
    render(<App api={api} />);
    await openSettings();
    await within(widget()).findByText('3:10 min');
    clickWalk('plus', 15);
    expect(await within(widget()).findByText('Aucun tram T1 direction Part-Dieu atteignable avec 15 min de trajet.')).toBeInTheDocument();
  });
});

it('borne le temps de trajet entre 0 et 30 minutes', async () => {
  render(<App api={createDemoApi()} />);
  await openSettings();
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

function setPageHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('appels à l’API', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'hidden');
  });

  it('n’appelle plus rien quand la page est masquée, et reprend à son retour', async () => {
    const api = createDemoApi();
    const getLinePassages = vi.spyOn(api, 'getLinePassages');
    render(<App api={api} />);
    await openSettings();
    await chooseLine('T1');
    await waitFor(() => expect(getLinePassages).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    try {
      setPageHidden(true);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(getLinePassages).toHaveBeenCalledTimes(1);
      setPageHidden(false);
      expect(getLinePassages).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(getLinePassages).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('garde les derniers passages, sans message, quand un appel échoue', async () => {
    const api = createDemoApi();
    render(<App api={api} />);
    await openSettings();
    await chooseLine('T1');
    await chooseStop('Arrêt B');
    const countdown = await within(widget()).findByText(/\d+:\d{2} min/);
    vi.spyOn(api, 'getLinePassages').mockRejectedValue(new Error('429 Trop de requêtes'));
    setPageHidden(true);
    setPageHidden(false);
    await waitFor(() => expect(api.getLinePassages).toHaveBeenCalled());
    expect(countdown).toBeInTheDocument();
    expect(widget()).toHaveTextContent(/Prochain tram T1 direction/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('n’affiche aucun message si la ligne ne répond pas du tout', async () => {
    const api: PassagesApi = {
      demo: false,
      getLines: async () => ['T1'],
      getLinePassages: () => Promise.reject(new Error('Accès refusé')),
      getStops: async () => [{ name: 'Arrêt A', ids: ['1'] }],
    };
    render(<App api={api} />);
    await openSettings();
    await chooseLine('T1');
    await chooseStop('Arrêt A');
    expect(await within(widget()).findByText('Aucun tram T1 annoncé à cet arrêt.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

it('sélectionne l’arrêt le plus proche de la position', async () => {
  mockPosition({ lat: 45.7486, lon: 4.8256 });
  render(<App api={createDemoApi()} />);
  await openSettings();
  await chooseLine('T1');
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByText(/Arrêt le plus proche de toi, à 10 m/)).toBeInTheDocument();
  expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt B');
  expect(await within(widget()).findByText(/\d+:\d{2} min/)).toBeInTheDocument();
});

describe('au chargement', () => {
  beforeEach(() => {
    localStorage.setItem('quandpartir.ligne', 'T1');
    localStorage.setItem('quandpartir.direction', 'Direction B');
    localStorage.setItem('quandpartir.arret', 'Arrêt A');
    localStorage.setItem('quandpartir.trajet', '6');
  });

  it('reprend ligne, direction et temps de trajet, puis géolocalise pour choisir l’arrêt', async () => {
    mockPosition({ lat: 45.7486, lon: 4.8256 });
    render(<App api={createDemoApi()} />);
    await openSettings();
    expect(await screen.findByText(/Arrêt le plus proche de toi, à 10 m/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ligne')).toHaveValue('T1');
    expect(screen.getByLabelText('Direction')).toHaveValue('Direction B');
    expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt B');
    expect(walk()).toHaveTextContent('6 min');
    expect(await within(widget()).findByText(/Prochain tram T1 direction Direction B/)).toBeInTheDocument();
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('garde l’arrêt retenu, sans message, si la localisation est refusée', async () => {
    mockPosition({ denied: true });
    render(<App api={createDemoApi()} />);
    await openSettings();
    await waitFor(() => expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled());
    expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt A');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

it('ne géolocalise pas au premier chargement, sans ligne retenue', async () => {
  mockPosition({ lat: 45.7486, lon: 4.8256 });
  render(<App api={createDemoApi()} />);
  await openSettings();
  await chooseLine('T1');
  await screen.findByRole('option', { name: 'Arrêt B' });
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

it('explique un refus de localisation', async () => {
  mockPosition({ denied: true });
  render(<App api={createDemoApi()} />);
  await openSettings();
  await chooseLine('T1');
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Localisation refusée');
});
