import { randomBytes, timingSafeEqual } from "node:crypto";
import { BaseController } from "./baseController.js";
import { usersRepo } from "../models/usersRepository.js";
import { authService } from "../services/authService.js";

export class UsersController extends BaseController {
  async guard(request, reply) {
    reply.header("Cache-Control", "no-store");
    request.session.userCsrf ||= randomBytes(32).toString("hex");
    if (request.method === "POST") {
      const supplied = request.body?._csrf;
      const expected = request.session.userCsrf;
      if (
        typeof supplied !== "string" ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      ) {
        return reply
          .code(403)
          .send("Invalid form token. Reload the form and try again.");
      }
    }
  }

  async list(request, reply) {
    return this.renderAdmin(request, reply, "admin/users/list.njk", {
      pageTitle: "Users",
      items: (await usersRepo.findAll()).map((user) =>
        authService.sanitizeUser(user),
      ),
      csrf: request.session.userCsrf,
    });
  }

  async form(request, reply, item = {}, error) {
    // Explicit fields only: passwords and hashes must never reach the view context.
    return this.renderAdmin(request, reply, "admin/users/form.njk", {
      pageTitle: item.id ? "Edit User" : "New User",
      item: {
        id: item.id,
        name: typeof item.name === "string" ? item.name : "",
        email: typeof item.email === "string" ? item.email : "",
      },
      csrf: request.session.userCsrf,
      ...(error ? { flash: { error } } : {}),
    });
  }

  async newUser(request, reply) {
    return this.form(request, reply);
  }
  async edit(request, reply) {
    const item = await authService.getUserById(request.params.id);
    if (!item) return reply.code(404).send("User not found");
    return this.form(request, reply, item);
  }

  async save(request, reply, id) {
    if (id && !(await authService.getUserById(id)))
      return reply.code(404).send("User not found");
    const body = request.body || {};
    try {
      if (body.password !== body.confirmPassword)
        throw new Error("Passwords do not match.");
      if (id) await authService.updateUser(id, body);
      else await authService.createUser(body);
      request.session.adminFlash = { success: "User saved successfully." };
      if (id === request.user.id && body.password) {
        reply.clearCookie("wcos_session", { path: "/" });
        return reply.redirect("/login");
      }
      return reply.redirect("/admin/users");
    } catch (error) {
      reply.code(400);
      return this.form(request, reply, { ...body, id }, error.message);
    }
  }
  async create(request, reply) {
    return this.save(request, reply);
  }
  async update(request, reply) {
    return this.save(request, reply, request.params.id);
  }
  async delete(request, reply) {
    if (!(await authService.getUserById(request.params.id)))
      return reply.code(404).send("User not found");
    try {
      await authService.deleteUser(request.params.id, request.user.id);
      request.session.adminFlash = { success: "User deleted successfully." };
      return reply.redirect("/admin/users");
    } catch (error) {
      reply.code(400);
      request.flash = { error: error.message };
      return this.list(request, reply);
    }
  }
}
export const usersController = new UsersController();
