import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '.local-releases/**',
    '**/.wrangler/**',
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),
  js.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['apps/server/**/*.ts', 'packages/shared/**/*.ts', 'e2e/**/*.ts', '**/*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^@penshow/server(?:/|$)|(?:^|/)server/|(?:^|/)data/)',
              message: 'A web consome somente contratos públicos de @penshow/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx', 'apps/web/src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(^@penshow/server(?:/|$)|(?:^|/)server/|(?:^|/)data/|^socket\\.io(?:-client)?(?:/|$)|(?:^|/)socket(?:[./-]|$))',
              message:
                'Componentes usam ações das stores; transporte e dados privados ficam fora da UI.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(^@penshow/(?:web|server)(?:/|$)|(?:^|/)apps/|(?:^|/)data/|^node:|^(?:react(?:-dom)?|fastify|@fastify/.*|socket\\.io(?:-client)?)(?:/|$))',
              message:
                'Shared contém contratos públicos independentes das aplicações e do transporte.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/server/src/**/domain/**/*.ts',
      'apps/server/src/**/domain.ts',
      'apps/server/src/**/*.domain.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(^node:|^@penshow/web(?:/|$)|(?:^|/)(?:platform|web)/|^(?:react(?:-dom)?|fastify|@fastify/.*|socket\\.io(?:-client)?)(?:/|$))',
              message:
                'Domínio puro recebe dependências explícitas e não importa transporte ou UI.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
