import { test as base, expect } from '../fixtures.ts';
import { createSite } from '../site.ts';
import { createClassicGroup } from '../classic-group.ts';
import { loadConfig } from '../../apps/server/src/platform/config.ts';
import { observeAudio, audioState } from '../sound-audit.ts';
import { observeNarrator, narratorAudio } from '../narrator-audit.ts';

const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const site = await createSite({
      config: loadConfig({ NODE_ENV: 'test', NARRATION_ENABLED: 'true' }),
    });
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
});
test('narrador: áudio robótico real antes das respostas, sem repetir por presença ou recarga', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  await observeAudio(host.context);
  await observeNarrator(host.context);
  const g = await createClassicGroup(site, players, [4, 3, 2, 1]);
  await host.page.getByRole('button', { name: 'Ativar narrador robótico', exact: true }).click();
  await expect(
    host.page.getByRole('button', { name: 'Desligar narrador', exact: true }),
  ).toBeVisible();
  await host.page.getByRole('button', { name: 'Ouvir a voz do robô', exact: true }).click();
  await expect(
    host.page.getByText('O robô está narrando o enunciado.', { exact: true }),
  ).toBeVisible();
  const preview = await host.page.request.get('/api/narration/preview');
  expect(preview.ok()).toBe(true);
  const wav = await preview.body();
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  await info.attach('voz-robotica-pt-br.wav', { body: wav, contentType: 'audio/wav' });
  await g.start();
  await g.prepareRound();
  await expect.poll(() => g.state().stage.phase).toBe('question-reading');
  const reading = g.state().stage;
  if (reading.phase !== 'question-reading') throw new Error();
  expect(reading.question.narration?.durationMs).toBeGreaterThan(0);
  for (const player of players)
    await expect(
      player.page.getByRole('group', { name: 'Escolha sua resposta', exact: true }),
    ).toHaveCount(0);
  await expect(
    host.page.getByText('O robô está narrando o enunciado.', { exact: true }),
  ).toBeVisible();
  expect((await audioState(host.page)).states).toContain('running');
  await expect.poll(async () => (await narratorAudio(host.page)).length).toBe(2);
  for (const source of await narratorAudio(host.page)) {
    expect(source.peak).toBeGreaterThan(0);
    expect(source.bufferDuration).toBeGreaterThan(0);
  }
  const opensAt = reading.opensAt;
  await guest.page.reload();
  await expect(
    guest.page.getByText(reading.question.publicQuestion.prompt, { exact: true }),
  ).toBeVisible();
  expect(['question-reading', 'question-open']).toContain(g.state().stage.phase);
  expect(g.state().stage).toMatchObject({ opensAt });
  expect((await narratorAudio(host.page)).length).toBe(2);
  await expect(
    host.page.getByRole('group', { name: 'Escolha sua resposta', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  const opened = g.state().stage;
  if (opened.phase !== 'question-open') throw new Error();
  expect(opened.deadlineAt - opened.opensAt).toBe(15000);
  await g.answer(host, true);
  await g.answer(guest, true);
  await expect(
    host.page.getByText('O robô está narrando o enunciado.', { exact: true }),
  ).toHaveCount(0);
  await host.audit.verify();
  await guest.audit.verify();
});
