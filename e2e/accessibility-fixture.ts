import { test as base } from './fixtures.ts';
import { createSite } from './site.ts';
import { LocalQuestionRepository } from '../apps/server/src/platform/local-question.repository.ts';
import { approvedQuestionSchema } from '../apps/server/src/modules/questions/editorial-question.schema.ts';
import {
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from '../apps/server/src/modules/scoring/match-rules.ts';

export const test = base.extend({
  // Private synthetic content and longer review windows; production catalog and rules stay intact.
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const repository = new LocalQuestionRepository();
    await repository.load();
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.timings.instructionsMs = 120_000;
    parameters.timings.readingMs = 150;
    parameters.timings.transitionMs = 100;
    parameters.timings.roundResultsMs = 500;
    parameters.wager.selectionMs = 12_000;
    parameters.theft.targetSelectionMs = 30_000;
    parameters.final.targetSelectionMs = 30_000;
    parameters.pressure.turnDifficulties = ['medium'];
    for (const mode of ['classic', 'speed', 'wager', 'theft'] as const) {
      parameters[mode].questions = { easy: 1, medium: 1, hard: 0 };
      parameters[mode].responseMs = 60_000;
    }
    parameters.speed.bonusBands.at(-1)!.beforeMs = 60_000;
    for (const mode of ['classic', 'speed', 'wager', 'theft', 'pressure', 'final'] as const)
      parameters[mode].revealMs = 1800;
    parameters.final.responseMs = 60_000;
    const site = await createSite({
      matchParameters: parameters,
      questions: {
        availability: () => repository.availability(),
        list: (filter) =>
          repository.list(filter).map((question) =>
            approvedQuestionSchema.parse({
              ...question,
              prompt:
                `${question.prompt} ${'Texto extenso para testar leitura e quebra de linha. '.repeat(45)}`.slice(
                  0,
                  2000,
                ),
              options: question.options.map((option) => ({
                ...option,
                text:
                  `${option.text} ${'Alternativa extensa com conteúdo legível. '.repeat(12)}`.slice(
                    0,
                    419,
                  ) +
                  ' ' +
                  'A'.repeat(80),
              })),
            }),
          ),
      },
    });
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
});
export { expect } from './fixtures.ts';
