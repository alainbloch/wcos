/**
 * Classes Repository
 * Handles training classes/locations
 */
import { BaseRepository } from './baseRepository.js';

export class ClassesRepository extends BaseRepository {
  constructor() {
    super('classes');
  }

  async findActive() {
    return this.findMany({ active: true });
  }
}

export const classesRepo = new ClassesRepository();