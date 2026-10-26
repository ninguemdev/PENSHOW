import { expect, it, vi } from 'vitest';
import { watchInterfaceSounds } from './interface-sounds';
import { testStores } from '../../test/fixtures';

it('descarta cliques programáticos e remove a escuta ao desmontar', () => {
  const { stores } = testStores();
  const interact = vi.spyOn(stores.sound.getState(), 'interact');
  const remove = vi.spyOn(document, 'removeEventListener');
  const stop = watchInterfaceSounds(stores.sound);
  const button = document.createElement('button');
  document.body.append(button);
  button.click();
  expect(interact).not.toHaveBeenCalled();
  stop();
  expect(remove).toHaveBeenCalledWith('click', expect.any(Function), true);
  button.remove();
  remove.mockRestore();
});
