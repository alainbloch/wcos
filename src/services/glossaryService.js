import {glossaryRepo} from '../models/database.js';
import {glossaryLetter,glossaryNameKey,sanitizeDefinition} from '../utils/glossary.js';
import sanitizeHtml from 'sanitize-html';
export function readGlossaryForm(body={}) {
  return {name:typeof body.name==='string'?body.name.trim():'',definition:typeof body.definition==='string'?body.definition:''};
}
export class GlossaryService {
  async getAll() {
    return (await glossaryRepo.findAll()).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true})).map(item=>({...item,definition:sanitizeDefinition(item.definition),letter:glossaryLetter(item.name)}));
  }
  async getById(id) { return glossaryRepo.findById(id); }
  async validate(body,id) {
    const data=readGlossaryForm(body);
    if(!data.name || data.name.length>200)throw new Error('Enter a glossary name of 1–200 characters');
    if(data.definition.length>50000)throw new Error('Definition must be at most 50,000 characters');
    data.definition=sanitizeDefinition(data.definition);
    if(!sanitizeHtml(data.definition,{allowedTags:[],allowedAttributes:{}}).trim())throw new Error('Definition is required');
    if((await glossaryRepo.findAll()).some(item=>item.id!==id&&glossaryNameKey(item.name)===glossaryNameKey(data.name)))throw new Error('A glossary item with that name already exists');
    return data;
  }
  async create(body) { return glossaryRepo.create(await this.validate(body)); }
  async update(id,body) { return glossaryRepo.update(id,await this.validate(body,id)); }
  async delete(id) { return glossaryRepo.delete(id); }
}
export const glossaryService=new GlossaryService();
