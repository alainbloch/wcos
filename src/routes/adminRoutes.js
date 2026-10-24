/**
 * Admin Routes
 * CMS administration routes
 */
import { adminController } from "../controllers/adminController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

export async function adminRoutes(fastify) {
  // Apply auth middleware to all admin routes
  fastify.addHook("preHandler", authMiddleware);

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

  // Settings (admin only)
  fastify.get(
    "/settings",
    { preHandler: requireRole("admin") },
    adminController.settings.bind(adminController),
  );
  fastify.post(
    "/settings",
    { preHandler: requireRole("admin") },
    adminController.updateSettings.bind(adminController),
  );
  fastify.post(
    "/settings/navigation",
    { preHandler: requireRole("admin") },
    adminController.updateNavigation.bind(adminController),
  );
}
