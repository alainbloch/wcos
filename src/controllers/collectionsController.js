import { installStarterViews } from "../services/collections/starters.js";
import { usersRepo } from "../models/database.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readdir } from "node:fs/promises";
import config from "../config/index.js";
import { BaseController } from "./baseController.js";
import { collectionStore, stateOf } from "../services/collections/store.js";
import { viewService, queryView } from "../services/collections/views.js";
import { TYPES } from "../services/collections/schema.js";
import { uploadMoveMedia } from "../services/moveMediaService.js";

export class CollectionsController extends BaseController {
  async guard(request, reply) {
    reply.header("Cache-Control", "no-store");
    if ((await usersRepo.findById(request.user?.id))?.role !== "admin")
      return reply.code(403).send({ error: "Administrator access required." });
    request.session.schemaCsrf ||= randomBytes(32).toString("hex");
    if (request.method !== "GET") {
      const supplied = request.headers["x-csrf-token"] || request.body?._csrf;
      const expected = request.session.schemaCsrf;
      if (
        typeof supplied !== "string" ||
        supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        return reply
          .code(403)
          .send({ error: "Invalid form token. Reload and try again." });
    }
  }
  async screen(request, reply) {
    const mode = request.url.startsWith("/admin/settings/database-schema")
      ? "schema"
      : request.url.startsWith("/admin/data-views")
        ? "views"
        : "records";
    return this.renderAdmin(request, reply, "admin/collections.njk", {
      pageTitle: {
        schema: "Database Schema",
        views: "Data Views",
        records: "Collections",
      }[mode],
      mode,
      csrf: request.session.schemaCsrf,
    });
  }
  async api(request, reply) {
    try {
      const action = request.params.action;
      const body = request.body || {};
      if (request.method === "GET") {
        if (action === "catalog")
          return {
            definitions: collectionStore.definitions(),
            views: viewService.list(),
            types: TYPES,
            history: stateOf(collectionStore.data()).history,
            csrf: request.session.schemaCsrf,
          };
        if (action === "records") {
          const definition = collectionStore.definition(
            request.query.collection,
          );
          if (["users", "siteSettings"].includes(definition.id))
            throw new Error("Use the system administration screen.");
          const fields = definition.fields.map((f) => f.name);
          if (!fields.length)
            return { records: [], total: 0, page: 1, pages: 0, pageSize: 20 };
          return queryView(
            collectionStore.data(),
            {
              id: "admin_list",
              name: "Records",
              collection: definition.id,
              fields,
              pageSize: 20,
            },
            request.query,
          );
        }
        if (action === "record") {
          const def = collectionStore.definition(request.query.collection);
          if (def.system) throw new Error("Use the system editor.");
          const record = collectionStore
            .rows(def.id)
            .find((r) => r.id === request.query.id);
          if (!record)
            return reply.code(404).send({ error: "Record not found." });
          return record;
        }
        if (action === "media") {
          let files = [];
          try {
            files = await readdir(config.uploadDir);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          return files
            .filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(f))
            .map((f) => `/uploads/${encodeURIComponent(f)}`);
        }
      } else {
        if (action === "preview-schema")
          return collectionStore.preview(body.definition);
        if (action === "save-schema")
          return await collectionStore.saveDefinition(
            body.definition,
            body.revision,
          );
        if (action === "delete-schema") {
          await collectionStore.deleteDefinition(body.id);
          return { success: true };
        }
        if (action === "rollback-preview") {
          const entry = stateOf(collectionStore.data()).history.find(
            (h) => h.id === body.id,
          );
          if (!entry?.definition)
            throw new Error(
              "No previous definition. Use explicit collection deletion.",
            );
          return collectionStore.preview(entry.definition);
        }
        if (action === "save-record")
          return await collectionStore.saveRecord(
            body.collection,
            body.record,
            body.id,
            body.replace === true,
          );
        if (action === "delete-record") {
          await collectionStore.deleteRecord(body.collection, body.id);
          return { success: true };
        }
        if (action === "starter-views") return await installStarterViews();
        if (action === "save-view") return await viewService.save(body.view);
        if (action === "delete-view") {
          await viewService.delete(body.id);
          return { success: true };
        }
        if (action === "preview-view")
          return queryView(collectionStore.data(), body.view, body.query || {});
        if (action === "upload")
          return await uploadMoveMedia(request.body.file);
      }
      return reply.code(404).send({ error: "Unknown action." });
    } catch (error) {
      return reply
        .code(400)
        .send({ error: error.message, fields: error.fields || {} });
    }
  }
}
export const collectionsController = new CollectionsController();
