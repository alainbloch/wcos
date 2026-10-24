import {beforeAll,afterAll,it,expect} from '@jest/globals';
import fs from 'node:fs';
import nunjucks from 'nunjucks';
import {load} from 'cheerio';
import {buildApp} from '../../src/app.js';
import {membersRepo,classesRepo,usersRepo,getDatabase} from '../../src/models/database.js';
import {authService} from '../../src/services/authService.js';
import {dynamicPageService} from '../../src/services/dynamicPageService.js';
import {migrateClasses,retiredCollections} from '../../src/models/migrations/classesInstructors.js';
let app,cookie,teachers,other;
beforeAll(async()=>{
 app=await buildApp();cookie=`wcos_session=${authService.generateToken(await usersRepo.findByEmail('admin@wcos.org'))}`;
 teachers=[];for(const merit of ['Kaiden','Honorary Kaiden','Head Kaiden']) teachers.push(await membersRepo.create({position:merit,merits:[merit]}));
 other=await membersRepo.create({position:'Other',merits:['Expert Swordsman']});
});
afterAll(async()=>{await app.close();});
const post=(url,payload)=>app.inject({method:'POST',url,headers:{cookie},payload});
it('offers all three Kaiden merits and saves multi, single and cleared selections',async()=>{
 const form=await app.inject({url:'/admin/classes/new',headers:{cookie}});expect(form.statusCode).toBe(200);const $=load(form.payload);
 for(const teacher of teachers) expect($(`[name=instructorIds][value="${teacher.id}"]`).length).toBe(1);
 expect($(`[name=instructorIds][value="${other.id}"]`).length).toBe(0);
 const created=await app.inject({method:'POST',url:'/admin/classes',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},payload:`name=Class&active=on&instructorIds=${teachers[0].id}&instructorIds=${teachers[1].id}`});
 expect(created.statusCode).toBe(302);const url=created.headers.location,id=url.split('/')[3];
 expect(await classesRepo.findById(id)).toMatchObject({instructorIds:[teachers[0].id,teachers[1].id],active:true});
 const edit=load((await app.inject({url,headers:{cookie}})).payload);expect(edit('[name=instructorIds]:checked').length).toBe(2);
 await post(url,{name:'Class',instructorIds:teachers[2].id});expect(await classesRepo.findById(id)).toMatchObject({instructorIds:[teachers[2].id],active:false});
 await post(url,{name:'Class'});expect((await classesRepo.findById(id)).instructorIds).toEqual([]);
});
it('rejects invalid instructors without changing data and restores failed forms',async()=>{
 const cls=await classesRepo.create({name:'Original',active:true,instructorIds:[teachers[0].id]});const url=`/admin/classes/${cls.id}/edit`;
 for(const instructorIds of [other.id,'missing',{id:teachers[0].id}]) expect((await post(url,{name:'Changed',instructorIds})).statusCode).toBe(400);
 expect((await classesRepo.findById(cls.id)).name).toBe('Original');
 const failed=await post(url,{name:'',instructorIds:[teachers[0].id,teachers[2].id]});const $=load(failed.payload);
 expect($('[name=instructorIds]:checked').length).toBe(2);expect($('[name=active]:checked').length).toBe(0);
 const create=await post('/admin/classes',{name:'',instructorIds:teachers[1].id});expect(create.statusCode).toBe(400);expect(load(create.payload)('form.admin-form').attr('action')).toBe('/admin/classes');
 expect((await post('/admin/classes/missing/edit',{name:'Missing'})).statusCode).toBe(404);
});
it('migrates page data and legacy fields without overwriting custom values, and is idempotent',()=>{
 const data={members:[{id:'vea',position:'Vea Ravenstar',merits:['Kaiden']},{id:'gad',position:'Gad',merits:['Head Kaiden']}],classes:[{id:'existing',location:'Hayward, CA',day:'Custom time',kaiden:'Kaiden GAD, Kaiden Vea',description:'Custom description',active:false}],pages:[{dataSources:['classes','ranks','members','dues']}],ranks:[{old:true}],dues:[],kaidens:[],kaidenRules:[]};
 migrateClasses(data);expect(data.classes).toHaveLength(7);
 expect(data.classes[0]).toMatchObject({id:'existing',schedule:'Custom time',description:'Custom description',active:false,instructorIds:['gad','vea']});
 expect(data.classes[0].kaiden).toBeUndefined();expect(data.classes[0].legacyClassData.kaiden).toContain('GAD');
 expect(data.members.find(m=>m.position==='Dalton')).toMatchObject({active:false,merits:['Honorary Kaiden']});
 expect(data.pages[0].dataSources).toEqual(['classes','members']);for(const name of retiredCollections) expect(data[name]).toBeUndefined();
 const before=structuredClone(data);migrateClasses(data);expect(data).toEqual(before);
});
it('preserves ambiguous and unmatched legacy instructor names for review',()=>{
 const data={members:[{id:'a',position:'Gad',merits:['Kaiden']},{id:'b',position:'Gad',merits:['Kaiden']}],classes:[{id:'custom',name:'Custom',location:'Custom',instructor:'Unknown Teacher',day:'Sunday'}]};
 migrateClasses(data);expect(data.classes[0].unresolvedInstructors).toEqual(['Unknown Teacher']);
 expect(data.classes.find(c=>c.location==='Hayward, CA').unresolvedInstructors).toContain('Kaiden GAD');
 expect(data.members.filter(m=>m.position.toLowerCase()==='gad')).toHaveLength(2);
});
it('renders active class data and live instructor names in the supplied layout',async()=>{
 getDatabase().data.classes=[{id:'public',name:'Public',location:'<b>Location</b>',schedule:'Monday',description:'Training',active:true,instructorIds:[teachers[0].id]},{id:'hidden',location:'Hidden class',active:false}];
 const html=fs.readFileSync(new URL('../../docs/cms/classes.html',import.meta.url),'utf8');
 const result=nunjucks.renderString(html,await dynamicPageService.resolveDataSources(['classes']));
 expect(result).toContain('&lt;b&gt;Location&lt;/b&gt;');expect(result).toContain('Monday');expect(result).toContain(teachers[0].position);expect(result).not.toContain('Hidden class');
 expect(result).toContain('westerncouncil@gmail.com');expect(result).toContain('table-row');
 await membersRepo.update(teachers[0].id,{position:'Renamed teacher'});
 const updated=await dynamicPageService.resolveDataSources(['classes']);expect(updated.classes[0].instructors[0].position).toBe('Renamed teacher');
});
it('removes unused admin endpoints and datasource options while preserving public pages',async()=>{
 for(const path of ['ranks','dues','kaidens','kaiden-rules']) expect((await app.inject({url:`/admin/${path}`,headers:{cookie}})).statusCode).toBe(404);
 for(const path of ['rank-requirements','dues','kaidens']) expect((await app.inject({url:`/${path}`})).statusCode).toBe(200);
 const form=(await app.inject({url:'/admin/pages/new',headers:{cookie}})).payload;const $=load(form);
 for(const name of retiredCollections) expect($(`[name=dataSources][value="${name}"]`).length).toBe(0);
});
