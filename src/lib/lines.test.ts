import { groupLines } from './lines';

it('range le métro, puis le tram, puis le bus', () => {
  const groups = groupLines(['86', 'T10', 'C3', 'B', 'F1', 'T2', 'A', 'JD550', '9', 'T1', 'D', 'F2', 'C', 'C25']);
  expect(groups).toEqual([
    { label: 'Métro et funiculaire', lines: ['A', 'B', 'C', 'D', 'F1', 'F2'] },
    { label: 'Tram', lines: ['T1', 'T2', 'T10'] },
    { label: 'Bus', lines: ['9', '86', 'C3', 'C25', 'JD550'] },
  ]);
});

it('omet les groupes vides', () => {
  expect(groupLines(['T1'])).toEqual([{ label: 'Tram', lines: ['T1'] }]);
});
