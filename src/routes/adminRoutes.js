import { collectionsController } from "../controllers/collectionsController.js";
import { dataTransferController } from "../controllers/dataTransferController.js";
import { MAX_FILE } from "../services/dataTransfer/format.js";
import { layoutController } from "../controllers/layoutController.js";
import { usersController } from "../controllers/usersController.js";
/**
 * Admin Routes
 * CMS administration routes
 */
import { adminController } from "../controllers/adminController.js";
import { authMiddleware } from "../middleware/auth.js";

export async function adminRoutes(fastify) {
  // Apply auth middleware to all admin routes
  fastify.addHook("preHandler", authMiddleware);

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

  fastify.get(
    "/layout",
    { preHandler: layoutController.guard.bind(layoutController) },
    (request, reply) => layoutController.edit(request, reply),
  );
  for (const [method, path, action] of [
    ["get", "/layout/:section", "edit"],
    ["post", "/layout/:section", "update"],
    ["post", "/layout/:section/preview", "preview"],
    ["post", "/layout/:section/restore", "restore"],
  ])
    fastify[method](
      path,
      { preHandler: layoutController.guard.bind(layoutController) },
      (request, reply) => layoutController[action](request, reply),
    );

  fastify.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_FILE },
    (_request, body, done) => done(null, body),
  );
  for (const [method, path, action] of [
    ["get", "/settings/data-transfer", "page"],
    ["get", "/settings/data-transfer/export/:format", "export"],
    ["post", "/settings/data-transfer/upload", "upload"],
    ["get", "/settings/data-transfer/preview/:token", "preview"],
    ["post", "/settings/data-transfer/apply", "apply"],
    ["get", "/settings/data-transfer/backups/:name", "backup"],
  ])
    fastify[method](
      path,
      {
        onRequest: authMiddleware,
        preHandler: dataTransferController.guard.bind(dataTransferController),
        bodyLimit: MAX_FILE,
      },
      (request, reply) => dataTransferController[action](request, reply),
    );

  for (const path of [
    "/settings/database-schema",
    "/collections",
    "/data-views",
  ])
    fastify.get(
      path,
      { preHandler: collectionsController.guard.bind(collectionsController) },
      collectionsController.screen.bind(collectionsController),
    );
  for (const method of ["get", "post"])
    fastify[method](
      "/schema-api/:action",
      { preHandler: collectionsController.guard.bind(collectionsController) },
      collectionsController.api.bind(collectionsController),
    );

  // Dashboard
  fastify.get("/", adminController.dashboard.bind(adminController));

  fastify.post(
    "/pages/preview",
    adminController.previewPage.bind(adminController),
  );

  // Every content collection uses the same controller. Old URLs remain aliases,
  // so bookmarks and existing form clients continue working after the migration.
  const routes = [
    ["get", "", "screen"],
    ["get", "/new", "screen"],
    ["get", "/:id/edit", "screen"],
    ["post", "", "save"],
    ["post", "/:id/edit", "save"],
    ["post", "/:id/delete", "remove"],
  ];
  for (const collection of [
    "pages",
    "members",
    "classes",
    "glossary",
    "updates",
    "moves",
  ]) {
    for (const [method, suffix, action] of routes)
      fastify[method](
        `/${collection}${suffix}`,
        {
          preHandler: async (request, reply) => {
            request.collection = collection;
            request.collectionCompatibility = true;
            await collectionsController.guard(request, reply);
            if (!reply.sent && collection === "updates") {
              if (request.isMultipart())
                request.body = Object.fromEntries(
                  Object.entries(request.body || {}).map(([key, value]) => [
                    key,
                    value?.type === "field" ? value.value : value,
                  ]),
                );
              await usersController.guard(request, reply);
            }
          },
        },
        collectionsController[action].bind(collectionsController),
      );
  }
  for (const [method, suffix, action] of routes)
    fastify[method](
      `/collections/:collection${suffix}`,
      { preHandler: collectionsController.guard.bind(collectionsController) },
      collectionsController[action].bind(collectionsController),
    );
  fastify.get(
    "/page-design/:id",
    adminController.editPage.bind(adminController),
  );
  fastify.post(
    "/updates/preview",
    { preHandler: usersController.guard.bind(usersController) },
    adminController.previewPage.bind(adminController),
  );
  const compatibilityGuard = async (request, reply) => {
    request.collectionCompatibility = true;
    return collectionsController.guard(request, reply);
  };
  fastify.post(
    "/moves/order",
    { preHandler: compatibilityGuard },
    (request, reply) => {
      request.collection = "moves";
      return collectionsController.reorder(request, reply);
    },
  );
  fastify.post(
    "/moves/media",
    { preHandler: compatibilityGuard },
    collectionsController.upload.bind(collectionsController),
  );
  fastify.get("/core-moves", (_request, reply) =>
    reply.redirect("/admin/moves"),
  );
  // Settings (admin only)
  fastify.get("/settings", adminController.settings.bind(adminController));
  fastify.post(
    "/settings",
    adminController.updateSettings.bind(adminController),
  );
}
