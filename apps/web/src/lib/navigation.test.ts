import { describe, expect, it } from 'vitest';
import { resolveRoute, routeHref } from './navigation';
describe('rotas sob o namespace configurado', () => {
  it('resolve navegação direta com e sem barra no caminho base', () => {
    expect(resolveRoute('/penshow', '/penshow/')).toEqual({ page: 'home' });
    expect(resolveRoute('/penshow/perfil', '/penshow/')).toEqual({ page: 'profile' });
    expect(resolveRoute('/penshow/sala/ABCDEF', '/penshow/')).toEqual({
      page: 'room',
      code: 'ABCDEF',
    });
    expect(routeHref('perfil', '/penshow/')).toBe('/penshow/perfil');
    expect(resolveRoute('/penshow/sala/abcdef', '/penshow/')).toEqual({
      page: 'room',
      code: 'ABCDEF',
    });
    expect(resolveRoute('/penshow/criar', '/penshow/')).toEqual({ page: 'create' });
  });
  it.each(['/comicle/perfil', '/penshow-mal/perfil', '/perfil', '/penshow/sala/ABCDEF/extra'])(
    'não confunde outra aplicação ou código inválido: %s',
    (path) => {
      expect(resolveRoute(path, '/penshow/')).toEqual({ page: 'error' });
    },
  );
});
