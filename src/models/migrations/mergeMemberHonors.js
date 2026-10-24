import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
export const honorsSeed=JSON.parse(fs.readFileSync(new URL('../../content/member-honors.json',import.meta.url),'utf8'));
const key=name=>(name||'').replace(/^(?:(?:head|honorary)\s+)?kaiden\s+|^master\s+/i,'').trim().toLowerCase().replace(/\s+/g,' ');
export function mergeMemberHonors(data) {
  data.members ||= [];data.honorsMigrationReview ||= [];
  const review=(reason,record)=>data.honorsMigrationReview.push({reason,record});
  function memberFor(record){
    const matches=data.members.filter(member=>key(member.position)===key(record.name));
    if(matches.length>1){review('Multiple matching members',record);return null;}
    let member=matches[0];
    if(!member){member={id:`members_${randomUUID()}`,position:record.name.replace(/^(?:(?:head|honorary)\s+)?kaiden\s+/i,''),active:false,merits:/^head kaiden /i.test(record.name)?['Head Kaiden']:/^honorary kaiden /i.test(record.name)?['Honorary Kaiden']:/^kaiden /i.test(record.name)?['Kaiden']:[],image:record.image||'',importedFrom:'hall-of-heroes'};data.members.push(member);}
    if(!member.image&&record.image)member.image=record.image;
    return member;
  }
  // Existing database awards take priority over matching source years.
  const legacy=data.champions||[];const covered=new Set(legacy.map(record=>Number(record.year)));
  const records=[...legacy,...honorsSeed.champions.filter(record=>!covered.has(record.year))];
  for(const record of records){
    if(/^no champion$/i.test(record.name||''))continue;
    const year=Number(record.year);
    if(!record.name||!/^\d{4}$/.test(String(record.year))||!Number.isInteger(year)){review('Invalid championship record',record);continue;}
    const source=honorsSeed.champions.find(item=>item.year===year&&key(item.name)===key(record.name));
    const member=memberFor({...source,...record,image:record.image||source?.image||''});if(!member)continue;
    member.championships ||= [];
    const owner=data.members.find(m=>m.id!==member.id&&(m.championships||[]).some(h=>h.year===year));
    if(owner){review(`Year ${year} already assigned to ${owner.position}`,record);continue;}
    if(!member.championships.some(h=>h.year===year))member.championships.push({year,note:record.note??(record.title?.includes('Champions Edition')?'Champions Edition':source?.note||'')});
  }
  for(const record of honorsSeed.fallenHeroes){const member=memberFor(record);if(member)member.fallenHero=true;}
  delete data.champions;data.migrations ||= {};data.migrations.memberHonors=true;
}
