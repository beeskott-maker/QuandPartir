import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { createDemoApi } from './lib/demoApi';
import type { PassagesApi } from './lib/types';

it('affiche les passages de la T1 à l’arrêt saisi', async () => {
  const api = createDemoApi();
  const getPassages = vi.spyOn(api, 'getPassages');
  render(<App api={api} />);
  expect(screen.getByText(/Mode démo/)).toBeInTheDocument();
  expect(screen.getByText('Ligne T1')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Code de l’arrêt TCL'), { target: { value: '42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Voir les passages' }));
  expect((await screen.findAllByText('T1')).length).toBeGreaterThan(0);
  expect(getPassages).toHaveBeenCalledWith('42', 'T1');
});

it('affiche l’erreur de l’API', async () => {
  const api: PassagesApi = { demo: false, getPassages: () => Promise.reject(new Error('Accès refusé')) };
  render(<App api={api} />);
  fireEvent.change(screen.getByLabelText('Code de l’arrêt TCL'), { target: { value: '42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Voir les passages' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
});
