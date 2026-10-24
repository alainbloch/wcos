/**
 * Kaidens Repository
 * Handles Kaiden information
 */
import { BaseRepository } from './baseRepository.js';

export class KaidensRepository extends BaseRepository {
  constructor() {
    super('kaidens');
  }
}

export const kaidensRepo = new KaidensRepository();