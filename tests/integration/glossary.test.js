import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
import {beforeAll,afterAll,it,expect,jest} from '@jest/globals';
import fs from 'node:fs';
import {load} from 'cheerio';
import {buildApp} from '../../src/app.js';
import {glossaryRepo,pagesRepo,usersRepo,getDatabase} from '../../src/models/database.js';
import {authService} from '../../src/services/authService.js';
import {glossaryService} from '../../src/services/glossaryService.js';
import {seedGlossary,glossarySeed} from '../../src/models/migrations/seedGlossary.js';
let app,cookie;
beforeAll(async()=>{app=await buildApp();await ensureReferencePages();cookie=`wcos_session=${authService.generateToken(await usersRepo.findByEmail('admin@wcos.org'))}`;});
afterAll(async()=>{await app.close();});
const post=(url,payload)=>app.inject({method:'POST',url,headers:{cookie},payload});
it('seeds all 69 entries and preserves existing definitions without duplicates',()=>{
 expect(glossarySeed).toHaveLength(69);const data={glossary:[{id:'keep',name:'Advanced Blocks',definition:'Edited'}]};seedGlossary(data);expect(data.glossary).toHaveLength(69);expect(data.glossary[0].definition).toBe('Edited');
 const before=structuredClone(data);seedGlossary(data);expect(data).toEqual(before);
 expect(data.glossary.find(i=>i.name.startsWith('Balance')).definition).toContain('<li>');
 expect(data.glossary.find(i=>i.name==='Dalmater').definition).toContain('<a href=');
});
it('requires authentication and supports create, read, update and delete',async()=>{
 expect((await app.inject({url:'/admin/glossary'})).statusCode).toBe(401);
 expect((await app.inject({url:'/admin/glossary/new',headers:{cookie}})).statusCode).toBe(200);
 const created=await post('/admin/glossary',{name:'Zebra term',definition:'<p>A definition</p>'});expect(created.statusCode).toBe(302);const url=created.headers.location,id=url.split('/')[3];
 expect((await app.inject({url,headers:{cookie}})).payload).toContain('Zebra term');
 await post(url,{name:'Alpha term',definition:'Updated'});expect(await glossaryRepo.findById(id)).toMatchObject({name:'Alpha term',definition:'Updated'});
 expect((await post(`/admin/glossary/${id}/delete`,{})).statusCode).toBe(302);expect(await glossaryRepo.findById(id)).toBeNull();expect((await post(url,{name:'Gone',definition:'Gone'})).statusCode).toBe(404);
});
it('validates names and definitions and redisplays failed create/edit forms',async()=>{
 const item=await glossaryService.create({name:'Unique test',definition:'Original'}),url=`/admin/glossary/${item.id}/edit`;
 const failed=await post(url,{name:'Changed name',definition:''});expect(failed.statusCode).toBe(400);expect(failed.payload).toContain('Changed name');expect(load(failed.payload)('form.admin-form').attr('action')).toBe(url);
 expect((await glossaryRepo.findById(item.id)).name).toBe('Unique test');
 const duplicate=await post('/admin/glossary',{name:' UNIQUE   TEST ',definition:'Other'});expect(duplicate.statusCode).toBe(400);expect(load(duplicate.payload)('form.admin-form').attr('action')).toBe('/admin/glossary');
 expect((await post('/admin/glossary',{name:'Blank',definition:'<script>alert(1)</script>'})).statusCode).toBe(400);
});
it('sanitizes rich definitions and rolls back database write failures',async()=>{
 const item=await glossaryService.create({name:'Safe markup',definition:'<p onclick="bad()">Text <strong>bold</strong></p><script>bad()</script><a href="javascript:bad()">Link</a>'});
 expect(item.definition).toContain('<strong>bold</strong>');expect(item.definition).not.toMatch(/onclick|script|javascript/);
 const fail=jest.spyOn(getDatabase(),'write').mockRejectedValueOnce(new Error('Disk full'));
 await expect(glossaryService.update(item.id,{name:'Changed',definition:'Changed'})).rejects.toThrow('Disk full');fail.mockRestore();expect((await glossaryRepo.findById(item.id)).name).toBe('Safe markup');
});
it('renders dynamic letter navigation, sorted groups, safe names and rich definitions through the real public route',async()=>{
 getDatabase().data.glossary=[];
 for(const item of [{name:'Zebra',definition:'<p>Last</p>'},{name:'apple',definition:'<ol><li>First</li></ol>'},{name:'Alpha',definition:'Second'},{name:'6 Deflections',definition:'Numeric'},{name:'The Retreat',definition:'The entry'},{name:'<img src=x onerror=bad()>',definition:'Escaped'}])await glossaryService.create(item);
 const page=await pagesRepo.findBySlug('glossary');await pagesRepo.update(page.id,{content:fs.readFileSync(new URL('../../docs/cms/glossary.html',import.meta.url),'utf8'),dataSources:['glossary']});
 const response=await app.inject({url:'/glossary'});expect(response.statusCode).toBe(200);const $=load(response.payload);
 expect($('#glossary-A .elementor-heading-title').text()).toBe('A');expect($('a[href="#glossary-Z"]').text()).toBe('Z');expect($('#glossary-T').length).toBe(1);expect($('#glossary-0-9').length).toBe(1);
 expect($('.glossary-entry .title').map((i,el)=>$(el).text()).get().filter(n=>['Alpha','apple'].includes(n))).toEqual(['Alpha','apple']);
 expect($('.glossary-entry ol li').text()).toBe('First');expect($('.glossary-entry img').length).toBe(0);
 expect(new Set($('.glossary-entry').map((i,el)=>$(el).attr('id')).get()).size).toBe(6);
 getDatabase().data.glossary=[];expect((await app.inject({url:'/glossary'})).payload).toContain('No glossary entries yet.');
});
