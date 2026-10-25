import { usersController } from "./usersController.js";
import { BaseController } from "./baseController.js";
import { updatesRepo } from "../models/updatesRepository.js";
import { updatesService, readUpdateForm } from "../services/updatesService.js";
import { adminController } from "./adminController.js";
import { pagesRepo } from "../models/database.js";
import { updateImageService } from "../services/updateImageService.js";
export class UpdatesController extends BaseController {
  async guard(request, reply) {
    if (request.isMultipart()) {
      request.body = Object.fromEntries(
        Object.entries(request.body || {}).map(([key, value]) => [
          key,
          value?.type === "field" ? value.value : value,
        ]),
      );
    }
    return usersController.guard(request, reply);
  }
  async list(request, reply) {
    const category = ["general", "council", "news"].includes(request.query.category)
      ? request.query.category
      : "";
    return this.renderAdmin(request, reply, "admin/updates/list.njk", {
      pageTitle: "Updates",
      items: await updatesService.getAll(category),
      category,
      csrf: request.session.userCsrf,
    });
  }
  async form(request, reply, item = {}, error) {
    const pages = (await pagesRepo.findAll() || []).map(p => ({ title: p.title, slug: p.slug }));
    const updates = await updatesRepo.findAll();
    const subcategories = [...new Set(updates.map(u => u.subcategory).filter(Boolean))];
    return this.renderAdmin(request, reply, "admin/updates/form.njk", {
      pageTitle: item.id ? "Edit Update" : "New Update",
      item,
      pages,
      subcategories,
      csrf: request.session.userCsrf,
      ...(error ? { flash: { error } } : {}),
    });
  }
  async newItem(request, reply) {
    return this.form(request, reply, { category: "general" });
  }
  async edit(request, reply) {
    const item = await updatesRepo.findById(request.params.id);
    if (!item) return reply.code(404).send("Update not found");
    return this.form(request, reply, item);
  }
  async save(request, reply, id) {
    const existing = id ? await updatesRepo.findById(id) : null;
    if (id && !existing)
      return reply.code(404).send("Update not found");
    request.body = { ...request.body, body: request.body.content };
    let uploadedImage = null;
    try {
      uploadedImage = await updateImageService.save(request.body?.image);
      if (uploadedImage) request.body.image = uploadedImage;
      else {
        request.body.image = existing?.image || "";
      }
      const item = id
        ? await updatesService.update(id, request.body)
        : await updatesService.create(request.body);
      request.session.adminFlash = { success: "Update saved." };
      return reply.redirect(`/admin/updates/${item.id}/edit`);
    } catch (error) {
      if (uploadedImage) {
        await updateImageService.discard(uploadedImage).catch(cleanupError => request.log.error(cleanupError));
      }
      reply.code(400);
      return this.form(
        request,
        reply,
        { ...readUpdateForm(request.body), image: existing?.image || "", id },
        error.message,
      );
    }
  }
  async create(request, reply) {
    return this.save(request, reply);
  }
  async update(request, reply) {
    return this.save(request, reply, request.params.id);
  }
  async delete(request, reply) {
    if (!(await updatesRepo.findById(request.params.id)))
      return reply.code(404).send("Update not found");
    await updatesRepo.delete(request.params.id);
    request.session.adminFlash = { success: "Update deleted." };
    return reply.redirect("/admin/updates");
  }
  async preview(request, reply) {
    request.body = { content: request.body.content };
    return adminController.previewPage(request, reply);
  }
}
export const updatesController = new UpdatesController();
