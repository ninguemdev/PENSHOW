import { open } from 'node:fs/promises';
import {
  publishedCatalogSchema,
  type PublishedCatalog,
} from '../modules/questions/catalog-format.js';
import type {
  QuestionFilter,
  QuestionRepository,
} from '../modules/questions/question.repository.js';

// Source and compiled platform directories have the same depth, independent of process.cwd().
export const DEFAULT_CATALOG_FILE = new URL(
  '../../../../data/questions/published/catalog.json',
  import.meta.url,
);
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
export class QuestionCatalogLoadError extends Error {
  constructor() {
    super(
      'Não foi possível carregar o catálogo privado de perguntas. Execute questions:check e confira o arquivo publicado.',
    );
    this.name = 'QuestionCatalogLoadError';
  }
}
export class LocalQuestionRepository implements QuestionRepository {
  private catalog: PublishedCatalog | null = null;
  constructor(private readonly file: string | URL = DEFAULT_CATALOG_FILE) {}

  async load(): Promise<void> {
    this.catalog = null;
    let handle;
    try {
      handle = await open(this.file, 'r');
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_CATALOG_BYTES) throw new Error();
      const raw: unknown = JSON.parse(await handle.readFile('utf8'));
      this.catalog = publishedCatalogSchema.parse(raw);
    } catch {
      // Never put private questions, answers, paths or schema input into startup logs.
      throw new QuestionCatalogLoadError();
    } finally {
      await handle?.close();
    }
  }
  list(filter: QuestionFilter = {}) {
    const catalog = this.ready();
    return structuredClone(
      catalog.questions.filter(
        (question) =>
          (filter.category === undefined || question.category === filter.category) &&
          (filter.difficulty === undefined || question.difficulty === filter.difficulty),
      ),
    );
  }
  availability() {
    return structuredClone(this.ready().manifest.availability);
  }
  private ready(): PublishedCatalog {
    if (!this.catalog) throw new Error('Catálogo privado ainda não carregado.');
    return this.catalog;
  }
}
