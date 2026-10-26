const marker = /^([ \t]*)respond @outsider 403[ \t]*(\r?\n)/gmu;

/** Add only the PENSHOW handler to the known Comicle proxy, preserving its original routes. */
export function addPenshowRoute(contents) {
  const matches = [...contents.matchAll(marker)];
  if (matches.length !== 1 || !contents.includes('reverse_proxy @game app:3000'))
    throw new Error(
      'Caddy diferente do modelo conhecido; conferir a configuração antes de integrar.',
    );
  const match = matches[0];
  const indent = match[1];
  const newline = match[2];
  const block = [
    '# BEGIN PENSHOW',
    'redir /penshow /penshow/ 308',
    'reverse_proxy /penshow/* penshow:3000',
    '# END PENSHOW',
  ]
    .map((line) => `${indent}${line}${newline}`)
    .join('');
  if (contents.includes('# BEGIN PENSHOW')) {
    if (contents.split(block).length !== 2)
      throw new Error(
        'Bloco PENSHOW existente diverge do esperado; não substituir automaticamente.',
      );
    return contents;
  }
  if (contents.includes('/penshow'))
    throw new Error('Já existe uma rota PENSHOW sem o marcador gerenciado.');
  return contents.replace(marker, (line) => `${line}${block}`);
}
