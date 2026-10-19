import { expect, it } from 'vitest';
import { safeNextPath } from './next-path';
it('retorna apenas para criação ou sala válida dentro do base PENSHOW', () => {
  expect(safeNextPath('/penshow/sala/ABCDEF', '/penshow/')).toBe('sala/ABCDEF');
  expect(safeNextPath('/penshow/criar', '/penshow/')).toBe('criar');
  for (const path of [
    null,
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/comicle/sala/ABCDEF',
    '/penshow/perfil',
    '/penshow/sala/INVALID',
    '/penshow/sala/ABCDEF?next=evil',
    '/penshow/sala/ABCDEF\n',
  ]) {
    expect(safeNextPath(path, '/penshow/')).toBe('');
  }
});
