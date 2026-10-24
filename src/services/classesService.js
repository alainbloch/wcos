import { classesRepo, membersRepo } from '../models/database.js';
import { isKaiden } from '../utils/memberDalmater.js';
export function readClassForm(body = {}) {
  const data=Object.fromEntries(['name','location','region','schedule','description'].map(key=>[key,typeof body[key]==='string'?body[key].trim():'']));
  data.instructorIds=[...new Set(Array.isArray(body.instructorIds)?body.instructorIds:body.instructorIds?[body.instructorIds]:[])];
  data.active=body.active===true || body.active==='on';return data;
}
export class ClassesService {
  async getInstructorOptions() { return (await membersRepo.findAll()).filter(isKaiden).sort((a,b)=>(a.position||'').localeCompare(b.position||'')); }
  async getAllClasses() {
    const members=await membersRepo.findAll();
    return (await classesRepo.findAll()).map(cls=>({...cls,instructors:(cls.instructorIds||[]).map(id=>members.find(member=>member.id===id)).filter(Boolean)}));
  }
  async getActiveClasses() { return (await this.getAllClasses()).filter(cls=>cls.active); }
  async getClassById(id) { return classesRepo.findById(id); }
  async validate(body) {
    const data=readClassForm(body), options=await this.getInstructorOptions();
    if (!data.name) throw new Error('Class name is required');
    if(data.instructorIds.some(id=>!options.some(member=>member.id===id))) throw new Error('Choose instructors with Kaiden, Honorary Kaiden, or Head Kaiden merits');
    return data;
  }
  async createClass(body) { return classesRepo.create(await this.validate(body)); }
  async updateClass(id,body) {
    if(!await classesRepo.findById(id)) throw new Error('Class not found');
    const data=await this.validate(body);
    if(body.clearUnresolved==='on') data.unresolvedInstructors=[];
    return classesRepo.update(id,data);
  }
  async deleteClass(id) { return classesRepo.delete(id); }
  async getClassesGroupedByRegion() {
    const grouped={};for(const cls of await this.getActiveClasses()) (grouped[cls.region||'Other'] ||= []).push(cls);return grouped;
  }
}
export const classesService=new ClassesService();
