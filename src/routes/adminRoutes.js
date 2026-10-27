import { collectionsController } from "../controllers/collectionsController.js";
import { dataTransferController } from "../controllers/dataTransferController.js";
import { MAX_FILE } from "../services/dataTransfer/format.js";
import { layoutController } from "../controllers/layoutController.js";
import { usersController } from "../controllers/usersController.js";
import { collectionStore } from "../services/collections/store.js";

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

  // Shared routes for every registered content collection.
  const collectionRoutes = [
    ["get", "", "screen"],
    ["get", "/new", "screen"],
    ["get", "/:id/edit", "screen"],
    ["post", "", "save"],
    ["post", "/:id/edit", "save"],
    ["post", "/:id/delete", "remove"],
    ["post", "/order", "reorder"],
    ["post", "/media", "upload"],
    ["get", "/:id/design", "design"],
    ["post", "/preview", "preview"],
  ];

  for (const prefix of ["/collections/:collection", "/:collection"]) {
    const legacyAlias = prefix === "/:collection";

    for (const [method, suffix, action] of collectionRoutes) {
      fastify[method](
        `${prefix}${suffix}`,
        {
          config: { legacyCollectionAlias: legacyAlias },
          preHandler: async (request, reply) => {
            const definition = collectionStore
              .definitions()
              .find((item) => item.id === request.params.collection);

            if (!definition) {
              return reply.code(404).send({
                error: "Collection not found.",
              });
            }

            if (definition.locked) {
              return reply.code(403).send({
                error: "Use the protected administration screen.",
              });
            }

            request.collection = definition.id;
            request.collectionDefinition = definition;

            if (request.isMultipart()) {
              request.body = Object.fromEntries(
                Object.entries(request.body || {}).map(([key, value]) => [
                  key,
                  value?.type === "field" ? value.value : value,
                ]),
              );
            }
            await collectionsController.guard(request, reply);
          },
        },
        async (request, reply) => {
          if (action === "design" || action === "preview") {
            if (request.collectionDefinition.capabilities?.[action] !== true)
              return reply
                .code(404)
                .send({
                  error: "This collection does not support that operation.",
                });
            return action === "design"
              ? adminController.designRecord(request, reply)
              : adminController.previewRecord(request, reply);
          }

          return collectionsController[action](request, reply);
        },
      );
    }
  }

  // Settings (admin only)
  fastify.get("/settings", adminController.settings.bind(adminController));
  fastify.post(
    "/settings",
    adminController.updateSettings.bind(adminController),
  );
}
