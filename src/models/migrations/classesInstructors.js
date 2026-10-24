import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isKaiden } from '../../utils/memberDalmater.js';
export const classSeed = JSON.parse(fs.readFileSync(new URL('../../content/classes.json', import.meta.url), 'utf8'));
export const retiredCollections = ['ranks', 'dues', 'kaidens', 'kaidenRules'];
const plainName = name => name.replace(/^(?:(?:head|honorary)\s+)?kaiden\s+/i, '').trim();
const key = name => plainName(name || '').toLowerCase().replace(/\s+/g, ' ');
const alias = name => ({vea:'vea ravenstar',severer:'the severer'}[key(name)] || key(name));
export function migrateClasses(data) {
  data.classes ||= []; data.members ||= [];
  for (const source of classSeed) {
    const matches=data.classes.filter(cls => key(cls.location) === key(source.location));
    if (!matches.length) data.classes.push({id:`classes_${randomUUID()}`, ...structuredClone(source)});
    else for (const cls of matches) {
      // Fill missing values only. Preserve edited schedules, descriptions and active flags.
      for (const field of ['name','region','description']) if (!cls[field]) cls[field]=source[field];
      if (!cls.schedule && !cls.day) cls.schedule=source.schedule;
      if (!cls.instructorIds && !cls.instructor && !cls.kaiden) cls.instructorNames=source.instructorNames;
    }
  }
  for (const cls of data.classes) {
    cls.name ||= cls.location || 'Class';
    cls.schedule ||= cls.day || '';
    if (typeof cls.active !== 'boolean') cls.active=cls.active === 'on' || cls.active === 'true' || cls.active == null;
    if (!Array.isArray(cls.instructorIds)) {
      const names=cls.instructorNames || (cls.instructor || cls.kaiden || '').split(/,|\n/).map(s=>s.trim()).filter(Boolean);
      cls.instructorIds=[];cls.unresolvedInstructors=[];
      for (const name of names) {
        const matches=data.members.filter(member=>alias(member.position)===alias(name));
        if (matches.length===1 && isKaiden(matches[0])) cls.instructorIds.push(matches[0].id);
        else if (!matches.length && classSeed.some(source=>source.instructorNames.includes(name))) {
          // The attached page explicitly identifies this teacher. Do not invent rank or activity.
          const member={id:`members_${randomUUID()}`,position:plainName(name),merits:[/^honorary/i.test(name)?'Honorary Kaiden':/^head/i.test(name)?'Head Kaiden':'Kaiden'],active:false, importedFrom:'classes-page'};
          data.members.push(member);cls.instructorIds.push(member.id);
        } else cls.unresolvedInstructors.push(name);
      }
      cls.instructorIds=[...new Set(cls.instructorIds)];
    }
    if (cls.instructor || cls.kaiden || cls.day) cls.legacyClassData ||= {instructor:cls.instructor,kaiden:cls.kaiden,day:cls.day};
    delete cls.instructor;delete cls.kaiden;delete cls.day;delete cls.instructorNames;
  }
  for (const name of retiredCollections) delete data[name];
  for (const page of data.pages || []) if (Array.isArray(page.dataSources)) page.dataSources=page.dataSources.filter(name=>!retiredCollections.includes(name));
  data.migrations ||= {};data.migrations.classesInstructors=true;
}
