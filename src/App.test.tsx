import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { createDemoApi } from './lib/demoApi';
import type { PassagesApi } from './lib/types';

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

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(navigator, 'geolocation');
});

it('affiche les passages de la T1 à l’arrêt choisi par son nom, et le retient', async () => {
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  expect(screen.getByText(/Mode démo/)).toBeInTheDocument();
  expect(screen.getByText('Ligne T1')).toBeInTheDocument();
  await screen.findByRole('option', { name: 'Arrêt B' });
  fireEvent.change(screen.getByLabelText('Arrêt'), { target: { value: 'Arrêt B' } });
  expect((await screen.findAllByText('T1')).length).toBeGreaterThan(0);
  expect(getPassages).toHaveBeenCalledWith(['3', '4'], 'T1');
  expect(localStorage.getItem('quandpartir.arret')).toBe('Arrêt B');
});

it('reprend l’arrêt choisi lors de la visite précédente', async () => {
  localStorage.setItem('quandpartir.arret', 'Arrêt C');
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  expect((await screen.findAllByText('T1')).length).toBeGreaterThan(0);
  expect(getPassages).toHaveBeenCalledWith(['5', '6'], 'T1');
});

it('affiche l’erreur de l’API', async () => {
  const api: PassagesApi = {
    demo: false,
    getStops: async () => [{ name: 'Arrêt A', ids: ['1'] }],
    getPassages: () => Promise.reject(new Error('Accès refusé')),
  };
  render(<App api={api} />);
  await screen.findByRole('option', { name: 'Arrêt A' });
  fireEvent.change(screen.getByLabelText('Arrêt'), { target: { value: 'Arrêt A' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
});

it('sélectionne l’arrêt le plus proche de la position', async () => {
  mockPosition({ lat: 45.7486, lon: 4.8256 });
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByText(/Arrêt le plus proche de toi, à 10 m/)).toBeInTheDocument();
  expect(screen.getByLabelText('Arrêt')).toHaveValue('Arrêt B');
  expect(getPassages).toHaveBeenCalledWith(['3', '4'], 'T1');
});

it('explique un refus de localisation', async () => {
  mockPosition({ denied: true });
  render(<App api={createDemoApi()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Arrêt le plus proche' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Localisation refusée');
});

it('affiche en haut le compte à rebours avant le prochain passage de l’arrêt choisi', async () => {
  const api = createDemoApi();
  render(<App api={api} />);
  const widget = screen.getByRole('region', { name: 'Prochain départ' });
  expect(widget).toHaveTextContent('Choisis un arrêt du T1 ci-dessous.');
  await screen.findByRole('option', { name: 'Arrêt A' });
  fireEvent.change(screen.getByLabelText('Arrêt'), { target: { value: 'Arrêt A' } });
  expect(await screen.findByText(/\d+:\d{2} minutes/)).toBeInTheDocument();
  expect(widget).toHaveTextContent('Partir dans');
  expect(widget).toHaveTextContent(/Prochain T1 direction Direction A à \d{2}:\d{2}/);
});
