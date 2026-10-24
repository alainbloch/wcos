import {BaseController} from './baseController.js';
import {glossaryService,readGlossaryForm} from '../services/glossaryService.js';
export class GlossaryController extends BaseController {
  async list(request,reply) { return this.renderAdmin(request,reply,'admin/glossary/list.njk',{pageTitle:'Glossary',items:await glossaryService.getAll()}); }
  async form(request,reply,item={},flash) { return this.renderAdmin(request,reply,'admin/glossary/form.njk',{pageTitle:item.id?'Edit Glossary Item':'New Glossary Item',item,flash}); }
  async newItem(request,reply) { return this.form(request,reply); }
  async edit(request,reply) {
    const item=await glossaryService.getById(request.params.id);
    if(!item)return reply.code(404).send('Glossary item not found');return this.form(request,reply,item);
  }
  async create(request,reply) {
    try { const item=await glossaryService.create(request.body);return reply.redirect(`/admin/glossary/${item.id}/edit`); }
    catch(error) { reply.code(400);return this.form(request,reply,readGlossaryForm(request.body),{error:error.message}); }
  }
  async update(request,reply) {
    if(!await glossaryService.getById(request.params.id))return reply.code(404).send('Glossary item not found');
    try { await glossaryService.update(request.params.id,request.body);return reply.redirect(`/admin/glossary/${request.params.id}/edit`); }
    catch(error) { reply.code(400);return this.form(request,reply,{...readGlossaryForm(request.body),id:request.params.id},{error:error.message}); }
  }
  async delete(request,reply) {
    if(!await glossaryService.getById(request.params.id))return reply.code(404).send('Glossary item not found');
    await glossaryService.delete(request.params.id);return reply.redirect('/admin/glossary');
  }
}
export const glossaryController=new GlossaryController();
