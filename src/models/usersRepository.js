/**
 * Users Repository
 * Handles user accounts and authentication
 */
import { BaseRepository } from './baseRepository.js';

export class UsersRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async findByUsername(username) {
    return this.findOne({ username });
  }
}

export const usersRepo = new UsersRepository();