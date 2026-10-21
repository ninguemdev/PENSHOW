import { test as base } from './fixtures.ts';
import { createSite } from './site.ts';
import {
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from '../apps/server/src/modules/scoring/match-rules.ts';

export const test = base.extend({
  // Short private match, with enough reveal time to reconnect to the same result.
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.timings.readingMs = 150;
    parameters.timings.transitionMs = 100;
    parameters.timings.roundResultsMs = 500;
    parameters.wager.selectionMs = 1500;
    for (const mode of ['classic', 'speed', 'wager', 'theft'] as const)
      parameters[mode].questions = { easy: 1, medium: 1, hard: 0 };
    for (const mode of ['classic', 'speed', 'wager', 'theft', 'pressure', 'final'] as const)
      parameters[mode].revealMs = 2500;
    const site = await createSite({ matchParameters: parameters });
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
});
export { expect } from './fixtures.ts';
