import { createDomainError } from '@penshow/shared';
import type { DomainErrorCode } from '@penshow/shared';

export class PublicCommandError extends Error {
  constructor(readonly code: DomainErrorCode) {
    super(createDomainError(code).message);
    this.name = 'PublicCommandError';
  }
}
