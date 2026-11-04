import { describe, it, expect } from 'vitest';
import { normalizeDate, yearsBetween } from '../../src/utils/dates.js';

describe('normalizeDate', () => {
  it.each([
    ['12/03/2004', '2004-03-12'],
    ['12-03-2004', '2004-03-12'],
    ['2004-03-12', '2004-03-12'],
    ['12 March 2004', '2004-03-12'],
    ['12th Mar 2004', '2004-03-12'],
    ['March 12, 2004', '2004-03-12'],
    ['1/1/99', '1999-01-01'],
  ])('reads %s as %s (day/month/year by default)', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it.each(['31/02/2004', '2004-13-01', 'yesterday', '', null])('rejects %s', (input) => {
    expect(normalizeDate(input)).toBeNull();
  });

  it('computes whole years between dates', () => {
    expect(yearsBetween('2004-03-12', '2022-03-11')).toBe(17);
    expect(yearsBetween('2004-03-12', '2022-03-12')).toBe(18);
  });
});
