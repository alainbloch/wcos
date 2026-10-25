import { layoutController } from '../controllers/layoutController.js';
import { usersController } from "../controllers/usersController.js";
import { glossaryController } from "../controllers/glossaryController.js";
/**
 * Admin Routes
 * CMS administration routes
 */
import { adminController } from "../controllers/adminController.js";
import { authMiddleware } from "../middleware/auth.js";

export async function adminRoutes(fastify) {
  // Apply auth middleware to all admin routes
  fastify.addHook("preHandler", authMiddleware);

  fastify.get("/glossary", glossaryController.list.bind(glossaryController));
  fastify.get(
    "/glossary/new",
    glossaryController.newItem.bind(glossaryController),
  );
  fastify.post("/glossary", glossaryController.create.bind(glossaryController));
  fastify.get(
    "/glossary/:id/edit",
    glossaryController.edit.bind(glossaryController),
  );
  fastify.post(
    "/glossary/:id/edit",
    glossaryController.update.bind(glossaryController),
  );
  fastify.post(
    "/glossary/:id/delete",
    glossaryController.delete.bind(glossaryController),
  );

  for (const [method, path, action] of [
    ["get", "/users", "list"],
    ["get", "/users/new", "newUser"],
    ["post", "/users", "create"],
    ["get", "/users/:id/edit", "edit"],
    ["post", "/users/:id/edit", "update"],
    ["post", "/users/:id/delete", "delete"],
  ])
    fastify[method](
      path,
      { preHandler: usersController.guard.bind(usersController) },
      usersController[action].bind(usersController),
    );

  fastify.get('/layout', { preHandler: layoutController.guard.bind(layoutController) }, (request, reply) => layoutController.edit(request, reply));
  for (const [method, path, action] of [
    ['get', '/layout/:section', 'edit'], ['post', '/layout/:section', 'update'],
    ['post', '/layout/:section/preview', 'preview'], ['post', '/layout/:section/restore', 'restore'],
  ]) fastify[method](path, { preHandler: layoutController.guard.bind(layoutController) }, (request, reply) => layoutController[action](request, reply));

  // Dashboard
  fastify.get("/", adminController.dashboard.bind(adminController));

  fastify.post(
    "/pages/preview",
    adminController.previewPage.bind(adminController),
  );

  // Pages
  fastify.get("/pages", adminController.listPages.bind(adminController));
  fastify.get("/pages/new", adminController.newPage.bind(adminController));
  fastify.post("/pages", adminController.createPage.bind(adminController));
  fastify.get(
    "/pages/:id/edit",
    adminController.editPage.bind(adminController),
  );
  fastify.post(
    "/pages/:id/edit",
    adminController.updatePage.bind(adminController),
  );
  fastify.post(
    "/pages/:id/delete",
    adminController.deletePage.bind(adminController),
  );

  // Members
  fastify.get("/members", adminController.listMembers.bind(adminController));
  fastify.get("/members/new", adminController.newMember.bind(adminController));
  fastify.post("/members", adminController.createMember.bind(adminController));
  fastify.get(
    "/members/:id/edit",
    adminController.editMember.bind(adminController),
  );
  fastify.post(
    "/members/:id/edit",
    adminController.updateMember.bind(adminController),
  );
  fastify.post(
    "/members/:id/delete",
    adminController.deleteMember.bind(adminController),
  );

  // Classes
  fastify.get("/classes", adminController.listClasses.bind(adminController));
  fastify.get("/classes/new", adminController.newClass.bind(adminController));
  fastify.post("/classes", adminController.createClass.bind(adminController));
  fastify.get(
    "/classes/:id/edit",
    adminController.editClass.bind(adminController),
  );
  fastify.post(
    "/classes/:id/edit",
    adminController.updateClass.bind(adminController),
  );
  fastify.post(
    "/classes/:id/delete",
    adminController.deleteClass.bind(adminController),
  );

  // Moves
  fastify.post(
    "/moves/order",
    adminController.reorderMoves.bind(adminController),
  );
  fastify.post(
    "/moves/media",
    adminController.uploadMoveMedia.bind(adminController),
  );
  fastify.get("/core-moves", (request, reply) =>
    reply.redirect("/admin/moves"),
  );
  fastify.get("/moves", adminController.listMoves.bind(adminController));
  fastify.get("/moves/new", adminController.newMove.bind(adminController));
  fastify.post("/moves", adminController.createMove.bind(adminController));
  fastify.get(
    "/moves/:id/edit",
    adminController.editMove.bind(adminController),
  );
  fastify.post(
    "/moves/:id/edit",
    adminController.updateMove.bind(adminController),
  );
  fastify.post(
    "/moves/:id/delete",
    adminController.deleteMove.bind(adminController),
  );
  // Settings (admin only)
  fastify.get("/settings", adminController.settings.bind(adminController));
  fastify.post(
    "/settings",
    adminController.updateSettings.bind(adminController),
  );
}
