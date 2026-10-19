import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Timer } from './timer';
import { clockOffset } from '../lib/time-sync';
it('mostra prazo textual compensado sem contar abaixo de zero e anuncia o fim', () => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const offset = clockOffset(9000, 9200, 9590, 9610);
  render(<Timer deadline={12500} offset={offset} />);
  expect(screen.getByRole('timer').textContent).toContain('2 segundos');
  expect(screen.getByRole('timer').getAttribute('aria-live')).toBe('off');
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole('timer').textContent).toContain('0 segundos');
  expect(screen.getByRole('status').textContent).toBe('Tempo encerrado');
});
