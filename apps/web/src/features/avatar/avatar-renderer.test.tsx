import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { defaultAvatar } from '@penshow/shared';
import { AvatarRenderer } from './avatar-renderer';
import { avatarArtUrl, avatarLayers } from './avatar-layers';

it('compõe as camadas na ordem e usa o caminho base, sem renderizar IDs desconhecidos', () => {
  const avatar = {
    ...defaultAvatar(),
    cheeks: 'cheeks-blush',
    hat: 'hat-crown',
    faceAccessory: 'face-accessory-glasses',
  };
  expect(avatarLayers(avatar).map((layer) => layer.category)).toEqual([
    'head',
    'cheeks',
    'eyes',
    'mouth',
    'faceAccessory',
    'hat',
  ]);
  expect(avatarArtUrl('head/head-round.png', '/penshow/')).toBe(
    '/penshow/avatars/head/head-round.png',
  );
  expect(
    avatarLayers({ ...avatar, head: '../secret', cheeks: null }).map((layer) => layer.category),
  ).toEqual(['eyes', 'mouth', 'faceAccessory', 'hat']);
});
it('agrupa as imagens sob um nome acessível e torna miniaturas decorativas', () => {
  const { container, rerender } = render(
    <AvatarRenderer avatar={defaultAvatar()} label="Personagem de Ana" />,
  );
  expect(screen.getByRole('img', { name: 'Personagem de Ana' })).toBeDefined();
  expect(container.querySelectorAll('img[alt=""]')).toHaveLength(3);
  rerender(<AvatarRenderer avatar={defaultAvatar()} size={32} />);
  expect(screen.queryByRole('img')).toBe(null);
  expect(container.querySelector('canvas')).toBe(null);
});
it('renderiza ajustes também em miniaturas e mantém a cabeça sem transformação', () => {
  const avatar = {
    ...defaultAvatar(),
    hair: 'hair-tousled',
    layout: {
      version: 1 as const,
      parts: { eyes: { x: 0.1, y: -0.1, scale: 1.5 } },
    },
  };
  const { container, rerender } = render(<AvatarRenderer avatar={avatar} size={256} />);
  const layers = avatarLayers(avatar);
  const eyes = container.querySelector<HTMLImageElement>('[data-avatar-part="eyes"]')!;
  const style = eyes.getAttribute('style');
  expect(eyes.style.width).toBe('150%');
  expect(layers.find((layer) => layer.category === 'head')?.rect).toEqual({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  expect(layers.map((layer) => layer.category)).toEqual(['head', 'eyes', 'mouth', 'hair']);
  rerender(<AvatarRenderer avatar={avatar} size={32} />);
  expect(eyes.getAttribute('style')).toBe(style);
});
