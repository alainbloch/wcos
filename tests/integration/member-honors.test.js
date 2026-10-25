import { ensureReferencePages } from "../../src/services/referenceSiteService.js";
import {beforeAll,afterAll,it,expect} from '@jest/globals';
import fs from 'node:fs';
import {load} from 'cheerio';
import {buildApp} from '../../src/app.js';
import {membersRepo,usersRepo,pagesRepo,getDatabase} from '../../src/models/database.js';
import {authService} from '../../src/services/authService.js';
import {memberService} from '../../src/services/memberService.js';
import {mergeMemberHonors,honorsSeed} from '../../src/models/migrations/mergeMemberHonors.js';
let app,cookie,member;
beforeAll(async()=>{app=await buildApp();await ensureReferencePages();cookie=`wcos_session=${authService.generateToken(await usersRepo.findByEmail('admin@wcos.org'))}`;member=await membersRepo.create({position:'Test Champion',level:'L3',active:false});});
afterAll(async()=>{await app.close();});
function post(values){return app.inject({method:'POST',url:`/admin/members/${member.id}/edit`,headers:{cookie,'content-type':'multipart/form-data; boundary=honors'},payload:Object.entries({circleName:'Test Champion',level:'L3',honorsPresent:'1',...values}).map(([name,value])=>`--honors\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join('')+'--honors--\r\n'});}
it('saves integer years and fallen status, preserves errors, and clears honors',async()=>{
 expect((await post({fallenHero:'on',championships:JSON.stringify([{year:'2022',note:'Champions Edition'},{year:'2023',note:''}])})).statusCode).toBe(302);
 expect(await membersRepo.findById(member.id)).toMatchObject({fallenHero:true,championships:[{year:2022,note:'Champions Edition'},{year:2023,note:''}]});
 const failed=await post({fallenHero:'on',championships:'[{"year":"2022.5","note":"Retained"}]'});expect(failed.statusCode).toBe(400);const $=load(failed.payload);expect($('[name=championships]').val()).toContain('Retained');expect($('[name=fallenHero]:checked').length).toBe(1);
 for(const entries of [[{year:2022},{year:2022}],[{year:'abc'}],[{year:0}]])expect((await post({championships:JSON.stringify(entries)})).statusCode).toBe(400);
 expect((await post({championships:'[]'})).statusCode).toBe(302);expect(await membersRepo.findById(member.id)).toMatchObject({fallenHero:false,championships:[]});
});
it('enforces uniqueness across members including concurrent saves',async()=>{
 const a=await membersRepo.create({position:'A'}),b=await membersRepo.create({position:'B'});
 const results=await Promise.allSettled([memberService.updateMember(a.id,{championships:[{year:2099}]}),memberService.updateMember(b.id,{championships:[{year:2099}]})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
});
it('migrates repeat winners and fallen heroes without inventing a No Champion member',()=>{
 const data={members:[{id:'gad',position:'Gad',image:'/custom.png',biography:'Keep',active:true}],champions:[{name:'Head Kaiden Gad',year:2010,title:'2010 Champion (Champions Edition)'},{name:'No Champion',year:2006}]};
 mergeMemberHonors(data);expect(data.champions).toBeUndefined();const gad=data.members.find(m=>m.id==='gad');expect(gad).toMatchObject({image:'/custom.png',biography:'Keep',active:true});expect(gad.championships.map(h=>h.year)).toEqual([2010,2012,2019]);
 expect(data.members.filter(m=>m.fallenHero)).toHaveLength(8);expect(data.members.some(m=>m.position==='Joel'&&m.fallenHero)).toBe(true);expect(data.members.some(m=>m.position==='No Champion')).toBe(false);
 const before=structuredClone(data);mergeMemberHonors(data);expect(data).toEqual(before);
 expect(honorsSeed.champions).toHaveLength(20);
});
it('flags ambiguous matches and conflicting legacy years for review',()=>{
 const data={members:[{id:'a',position:'Joseph'},{id:'b',position:'Joseph'},{id:'c',position:'Other',championships:[{year:2000}]}],champions:[{name:'Joseph',year:2001},{name:'Dave',year:2000}]};mergeMemberHonors(data);
 expect(data.honorsMigrationReview.some(i=>i.reason==='Multiple matching members')).toBe(true);expect(data.honorsMigrationReview.some(i=>i.reason.includes('already assigned'))).toBe(true);
});
it('renders the same winners in both layouts, inactive heroes, images and unique modal templates',async()=>{
 getDatabase().data.members=[];mergeMemberHonors(getDatabase().data);
 const page=await pagesRepo.findBySlug('hall-of-heroes');await pagesRepo.update(page.id,{content:fs.readFileSync('docs/cms/hall-of-heroes.html','utf8'),dataSources:['champions','fallenHeroes','members']});
 const result=await app.inject({url:'/hall-of-heroes'});expect(result.statusCode).toBe(200);const $=load(result.payload);
 expect($('.profile-title').filter((i,e)=>$(e).text().includes('2010')).closest('.profile-body').text()).toContain('Gad');
 expect(result.payload).toContain('Joel');expect(result.payload).toContain('2006: No Champion.');expect(result.payload).toContain('The Black Braid');expect($('[data-modal-target]').length).toBe(48);
 const ids=$('template').map((i,e)=>$(e).attr('id')).get();expect(new Set(ids).size).toBe(ids.length);
 expect((await app.inject({url:'/admin/champions',headers:{cookie}})).statusCode).toBe(404);
});
it('allows editing an imported historical profile without inventing its rank',async()=>{
 const imported=getDatabase().data.members.find(m=>m.importedFrom==='hall-of-heroes');member=imported;
 const response=await post({circleName:imported.position,level:'',fallenHero:'on',championships:JSON.stringify(imported.championships||[])});expect(response.statusCode).toBe(302);expect((await membersRepo.findById(member.id)).level).toBe('');
});
