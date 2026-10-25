import { otherDirection } from './directions';

it('choisit la direction suivante', () => {
  expect(otherDirection(['A', 'B'], 'A')).toBe('B');
  expect(otherDirection(['A', 'B'], 'B')).toBe('A');
  expect(otherDirection(['A', 'B'], '')).toBe('A');
  expect(otherDirection(['A', 'B', 'C'], 'C')).toBe('A');
});
