import { beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import nunjucks from 'nunjucks';
import { buildApp } from '../../src/app.js';
import { movesRepo, membersRepo, usersRepo, getDatabase } from '../../src/models/database.js';
import { authService } from '../../src/services/authService.js';
import { dynamicPageService } from '../../src/services/dynamicPageService.js';
import { renameMoves } from '../../src/models/migrations/renameMoves.js';
import { seedCoreMoves, coreMoveSeed } from '../../scripts/seed-core-moves.js';
let app, cookie, creator;
beforeAll(async () => {
  app = await buildApp();
  cookie = `wcos_session=${authService.generateToken(await usersRepo.findByEmail('admin@wcos.org'))}`;
  getDatabase().data.moves = [];
  creator = await membersRepo.create({ position: 'Creator' });
});
afterAll(async () => { await app.close(); });
const post = (url, payload) => app.inject({ method:'POST', url, headers:{cookie}, payload });
it('requires authentication and renders create and list pages', async () => {
  expect((await app.inject({url:'/admin/moves'})).statusCode).toBe(401);
  for (const url of ['/admin/moves','/admin/moves/new']) expect((await app.inject({url,headers:{cookie}})).statusCode).toBe(200);
});
it('creates, validates, updates and deletes moves, preserving invalid form data', async () => {
  const media = [{type:'image',url:'https://example.com/a.png',caption:'A'},{type:'video',url:'/uploads/video.mp4',caption:'B'}];
  expect((await post('/admin/moves',{name:'Test',creatorId:creator.id,core:'on',media:JSON.stringify(media)})).statusCode).toBe(302);
  const move = (await movesRepo.findAll())[0];
  expect(move).toMatchObject({core:true, creatorId:creator.id, media});
  const url = `/admin/moves/${move.id}/edit`;
  const bad = await post(url,{name:'Unsaved',creatorId:'missing',media:'[]'});
  expect(bad.statusCode).toBe(400); expect(bad.payload).toContain('Unsaved'); expect(bad.payload).toContain(creator.position);
  expect((await movesRepo.findById(move.id)).name).toBe('Test');
  expect((await post(url,{name:'Test', media:JSON.stringify([...media].reverse())})).statusCode).toBe(302);
  expect(await movesRepo.findById(move.id)).toMatchObject({core:false,media:[...media].reverse()});
  expect((await post(url,{name:'Test',media:'[{"type":"image","url":"javascript:alert(1)"}]'})).statusCode).toBe(400);
  expect((await post('/admin/moves',{name:'',media:'[]'})).payload).toContain('action="/admin/moves"');
  expect((await post(`/admin/moves/${move.id}/delete`,{})).statusCode).toBe(302);
  expect((await post(url,{name:'Gone'})).statusCode).toBe(404);
});
it('saves an exact permutation and rolls back failed persistence', async () => {
  const a=await movesRepo.create({name:'A'}), b=await movesRepo.create({name:'B'});
  expect((await post('/admin/moves/order',{ids:[b.id,a.id]})).statusCode).toBe(200);
  expect((await movesRepo.findAll()).map(m=>m.id)).toEqual([b.id,a.id]);
  for (const ids of [[a.id], [a.id,a.id], [a.id,'unknown']]) expect((await post('/admin/moves/order',{ids})).statusCode).toBe(400);
  const fail=jest.spyOn(getDatabase(),'write').mockRejectedValueOnce(new Error('disk full'));
  await expect(movesRepo.reorder([a.id,b.id])).rejects.toThrow('disk full'); fail.mockRestore();
  expect((await movesRepo.findAll()).map(m=>m.id)).toEqual([b.id,a.id]);
});
it('migrates legacy records idempotently and seeds all 45 real moves without duplicates', async () => {
  const data={coreMoves:[{id:'old',name:'Old',details:'Keep'}]}; renameMoves(data); renameMoves(data);
  expect(data.coreMoves).toBeUndefined(); expect(data.moves).toEqual([expect.objectContaining({id:'old',core:true,details:'Keep'})]);
  const types={coreMoves:[{id:'type',name:'Initiated Response'}]}; renameMoves(types); expect(types.moves[0].core).toBe(false);
  expect(coreMoveSeed).toHaveLength(45); expect(await seedCoreMoves()).toBe(45); expect(await seedCoreMoves()).toBe(0);
});
it('renders only ordered core moves, with escaped content and ordered media', async () => {
  const sources=await dynamicPageService.resolveDataSources(['coreMoves','moves']);
  expect(sources.moves.length).toBeGreaterThan(sources.coreMoves.length);
  expect(sources.coreMoves.every(m=>m.core)).toBe(true);
  const html=fs.readFileSync(new URL('../../docs/cms/core-moves.html',import.meta.url),'utf8');
  const result=nunjucks.renderString(html,{...sources,members:[creator]});
  expect(result).toContain('Jumping Tiger'); expect(result).toContain('Jaguar');
  expect(result).toContain('Initiated Response'); expect(result).not.toContain('>A</span>');
  const escaped=nunjucks.renderString(html,{coreMoves:[{id:'x',name:'<script>bad</script>',media:[{type:'video',url:'/uploads/test.mp4'}]}]});
  expect(escaped).toContain('&lt;script&gt;'); expect(escaped).toContain('<video controls');
});
it('rejects fake video uploads and accepts a decoded image', async () => {
  const sharp=(await import('sharp')).default;
  const image=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
  const upload = (bytes,type,name) => app.inject({method:'POST',url:'/admin/moves/media',headers:{cookie,'content-type':'multipart/form-data; boundary=media'},payload:Buffer.concat([Buffer.from(`--media\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`),bytes,Buffer.from('\r\n--media--\r\n')])});
  expect((await upload(Buffer.from('not video'),'video/mp4','fake.mp4')).statusCode).toBe(400);
  const response=await upload(image,'image/png','test.png'); expect(response.statusCode).toBe(200); expect(response.json().type).toBe('image');
  const {memberImageService}=await import('../../src/services/memberImageService.js'); await memberImageService.discard(response.json().url);
});
