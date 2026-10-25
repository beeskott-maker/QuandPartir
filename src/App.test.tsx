import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { createDemoApi } from './lib/demoApi';
import type { PassagesApi } from './lib/types';

afterEach(() => {
  localStorage.clear();
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
