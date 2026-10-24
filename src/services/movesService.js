import { movesRepo, membersRepo } from '../models/database.js';
export const MOVE_TYPES = ['Straight Offense', 'Offensive Defense', 'Initiated Response'];
const text = value => typeof value === 'string' ? value : '';
export function readMoveForm(body = {}) {
  const data = Object.fromEntries(['name','category','description','details','creatorId'].map(key => [key, text(body[key]).trim()]));
  data.types = [...new Set(Array.isArray(body.types) ? body.types : body.types == null ? [] : [body.types])];
  data.core = body.core === true || body.core === 'on';
  data.media = body.media ?? '[]';
  return data;
}
export class MovesService {
  async getAllMoves() { return movesRepo.findAll(); }
  async getMoveById(id) { return movesRepo.findById(id); }
  async validate(body) {
    const data = readMoveForm(body);
    if (data.types.some(type => !MOVE_TYPES.includes(type))) throw new Error('Choose valid move types');
    if (!data.name) throw new Error('Move name is required');
    if (data.creatorId && !await membersRepo.findById(data.creatorId)) throw new Error('Choose an existing member as creator');
    try { if (typeof data.media === 'string') data.media = JSON.parse(data.media); } catch { throw new Error('Invalid media list'); }
    if (!Array.isArray(data.media) || data.media.length > 100) throw new Error('Invalid media list');
    data.media = data.media.map(item => {
      if (!item || !['image','video'].includes(item.type) || typeof item.url !== 'string' || !(/^(https?:\/\/[^\s]+|\/uploads\/[a-zA-Z0-9_.-]+)$/.test(item.url))) throw new Error('Media must use an image or video with an HTTP(S) URL or uploaded file');
      return { type: item.type, url: item.url, caption: text(item.caption) };
    });
    return data;
  }
  async createMove(body) { return movesRepo.create(await this.validate(body)); }
  async updateMove(id, body) { return movesRepo.update(id, await this.validate(body)); }
  async deleteMove(id) { return movesRepo.delete(id); }
}
export const movesService = new MovesService();
