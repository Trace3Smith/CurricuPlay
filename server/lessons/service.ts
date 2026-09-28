import { lessonSaveInput, reflectionInput, scheduleLessonInput, taughtInput } from '../../shared/contracts/lessons';
import type { LessonRepository } from './ports';
import { AppError } from '../ports';

/** SQL performs workspace, exact-reference, date and concurrency checks atomically for every caller. */
export function lessonService(repository: LessonRepository) {
  return {
    list: () => repository.read(),
    async save(id: string | null, input: unknown) {
      const value = lessonSaveInput.parse(input);
      if (!!id !== !!value.revision || (id && !value.sourceVersionId)) throw new AppError(400, 'Revising a lesson requires its saved version and current revision.');
      return repository.save(id, value);
    },
    schedule: (input: unknown) => repository.schedule(scheduleLessonInput.parse(input)),
    markTaught: (id: string, input: unknown) => repository.markTaught(id, taughtInput.parse(input).taughtOn),
    reflect: (id: string, input: unknown) => repository.reflect(id, reflectionInput.parse(input)),
  };
}
