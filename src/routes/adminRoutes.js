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

  // Champions
  fastify.get("/champions", adminController.listChampions.bind(adminController));
  fastify.get("/champions/new", adminController.newChampion.bind(adminController));
  fastify.post("/champions", adminController.createChampion.bind(adminController));
  fastify.get(
    "/champions/:id/edit",
    adminController.editChampion.bind(adminController),
  );
  fastify.post(
    "/champions/:id/edit",
    adminController.updateChampion.bind(adminController),
  );
  fastify.post(
    "/champions/:id/delete",
    adminController.deleteChampion.bind(adminController),
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

  // Ranks
  fastify.get("/ranks", adminController.listRanks.bind(adminController));
  fastify.get("/ranks/new", adminController.newRank.bind(adminController));
  fastify.post("/ranks", adminController.createRank.bind(adminController));
  fastify.get(
    "/ranks/:id/edit",
    adminController.editRank.bind(adminController),
  );
  fastify.post(
    "/ranks/:id/edit",
    adminController.updateRank.bind(adminController),
  );
  fastify.post(
    "/ranks/:id/delete",
    adminController.deleteRank.bind(adminController),
  );

  // Core Moves
  fastify.get("/core-moves", adminController.listCoreMoves.bind(adminController));
  fastify.get("/core-moves/new", adminController.newCoreMove.bind(adminController));
  fastify.post("/core-moves", adminController.createCoreMove.bind(adminController));
  fastify.get(
    "/core-moves/:id/edit",
    adminController.editCoreMove.bind(adminController),
  );
  fastify.post(
    "/core-moves/:id/edit",
    adminController.updateCoreMove.bind(adminController),
  );
  fastify.post(
    "/core-moves/:id/delete",
    adminController.deleteCoreMove.bind(adminController),
  );

  // Dalmater Colors
  fastify.get("/dalmater-colors", adminController.listDalmaterColors.bind(adminController));
  fastify.get("/dalmater-colors/new", adminController.newDalmaterColor.bind(adminController));
  fastify.post("/dalmater-colors", adminController.createDalmaterColor.bind(adminController));
  fastify.get(
    "/dalmater-colors/:id/edit",
    adminController.editDalmaterColor.bind(adminController),
  );
  fastify.post(
    "/dalmater-colors/:id/edit",
    adminController.updateDalmaterColor.bind(adminController),
  );
  fastify.post(
    "/dalmater-colors/:id/delete",
    adminController.deleteDalmaterColor.bind(adminController),
  );

  // Kaidens
  fastify.get("/kaidens", adminController.listKaidens.bind(adminController));
  fastify.get("/kaidens/new", adminController.newKaiden.bind(adminController));
  fastify.post("/kaidens", adminController.createKaiden.bind(adminController));
  fastify.get(
    "/kaidens/:id/edit",
    adminController.editKaiden.bind(adminController),
  );
  fastify.post(
    "/kaidens/:id/edit",
    adminController.updateKaiden.bind(adminController),
  );
  fastify.post(
    "/kaidens/:id/delete",
    adminController.deleteKaiden.bind(adminController),
  );

  // Kaiden Rules
  fastify.get("/kaiden-rules", adminController.listKaidenRules.bind(adminController));
  fastify.get("/kaiden-rules/new", adminController.newKaidenRule.bind(adminController));
  fastify.post("/kaiden-rules", adminController.createKaidenRule.bind(adminController));
  fastify.get(
    "/kaiden-rules/:id/edit",
    adminController.editKaidenRule.bind(adminController),
  );
  fastify.post(
    "/kaiden-rules/:id/edit",
    adminController.updateKaidenRule.bind(adminController),
  );
  fastify.post(
    "/kaiden-rules/:id/delete",
    adminController.deleteKaidenRule.bind(adminController),
  );

  // Resources
  fastify.get("/resources", adminController.listResources.bind(adminController));
  fastify.get("/resources/new", adminController.newResource.bind(adminController));
  fastify.post("/resources", adminController.createResource.bind(adminController));
  fastify.get(
    "/resources/:id/edit",
    adminController.editResource.bind(adminController),
  );
  fastify.post(
    "/resources/:id/edit",
    adminController.updateResource.bind(adminController),
  );
  fastify.post(
    "/resources/:id/delete",
    adminController.deleteResource.bind(adminController),
  );

  // Dues
  fastify.get("/dues", adminController.listDues.bind(adminController));
  fastify.get("/dues/new", adminController.newDues.bind(adminController));
  fastify.post("/dues", adminController.createDues.bind(adminController));
  fastify.get(
    "/dues/:id/edit",
    adminController.editDues.bind(adminController),
  );
  fastify.post(
    "/dues/:id/edit",
    adminController.updateDues.bind(adminController),
  );
  fastify.post(
    "/dues/:id/delete",
    adminController.deleteDues.bind(adminController),
  );

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