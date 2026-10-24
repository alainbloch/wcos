import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {glossaryNameKey,sanitizeDefinition} from '../../utils/glossary.js';
export const glossarySeed=JSON.parse(fs.readFileSync(new URL('../../content/glossary.json',import.meta.url),'utf8'));
export function seedGlossary(data) {
  data.glossary ||= [];
  const existing=new Set(data.glossary.map(item=>glossaryNameKey(item.name)));
  for(const item of glossarySeed) {
    if(!existing.has(glossaryNameKey(item.name))) {
      data.glossary.push({id:`glossary_${randomUUID()}`,name:item.name,definition:sanitizeDefinition(item.definition)});
      existing.add(glossaryNameKey(item.name));
    }
  }
  data.migrations ||= {};data.migrations.glossary=true;
}
