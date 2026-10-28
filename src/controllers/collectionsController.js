import { isKaiden, normalizeHex } from "../utils/memberDalmater.js";
import {
  councilMembers,
  currentCouncilMembers,
} from "../utils/councilMembership.js";
import {
  readGeneratedForm,
  readLegacyForm,
} from "../services/collections/forms.js";
import { memberImageService } from "../services/memberImageService.js";
import { updateImageService } from "../services/updateImageService.js";
import { sanitizePageContent } from "../services/referenceSiteService.js";
import { installStarterViews } from "../services/collections/starters.js";
import { usersRepo } from "../models/database.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readdir } from "node:fs/promises";
import config from "../config/index.js";
import { BaseController } from "./baseController.js";
import { collectionStore, stateOf } from "../services/collections/store.js";
import { viewService, queryView } from "../services/collections/views.js";
import { TYPES } from "../services/collections/schema.js";
import { uploadCollectionMedia } from "../services/collectionMediaService.js";

export class CollectionsController extends BaseController {
  async guard(request, reply) {
    reply.header("Cache-Control", "no-store");
    if ((await usersRepo.findById(request.user?.id))?.role !== "admin")
      return reply.code(403).send({ error: "Administrator access required." });
    request.session.schemaCsrf ||= randomBytes(32).toString("hex");
    if (request.method !== "GET") {
      const token = request.body?._csrf;
      const supplied =
        request.headers["x-csrf-token"] ||
        (token?.type === "field" ? token.value : token);
      const tokens = [request.session.schemaCsrf];
      if (request.routeOptions.config.legacyCollectionAlias)
        tokens.push(request.session.userCsrf);
      if (
        typeof supplied !== "string" ||
        !tokens.some(
          (expected) =>
            typeof expected === "string" &&
            Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
            timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)),
        )
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
    const collection =
      request.collection ||
      request.params.collection ||
      request.query.collection;
    const definition = collection
      ? collectionStore.definitions().find((d) => d.id === collection)
      : null;
    if (collection && !definition)
      return reply.code(404).send("Collection not found.");
    if (definition?.locked)
      return reply
        .code(403)
        .send("Use protected account or site settings administration.");
    const recordId = request.params.id || request.query.record;
    const isNew =
      request.url.split("?")[0].endsWith("/new") ||
      request.query.new === "true";
    const record =
      request.formRecord ||
      (recordId
        ? collectionStore.rows(collection).find((r) => r.id === recordId)
        : {});
    if (recordId && !record) return reply.code(404).send("Record not found.");
    return this.renderAdmin(request, reply, "admin/collections.njk", {
      initialCollection: collection,
      recordId,
      isNew,
      definition,
      record,
      unsavedJson: JSON.stringify(record),
      unsavedErrorsJson: JSON.stringify(request.formErrors || {}),
      formAction: `/admin/collections/${encodeURIComponent(collection || "")}${recordId ? `/${encodeURIComponent(recordId)}/edit` : ""}`,
      formValues: Object.fromEntries(
        Object.entries(record || {}).map(([key, value]) => [
          key,
          value && typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : value,
        ]),
      ),
      records:
        definition && !recordId && !isNew
          ? this.filterLegacy(
              collection,
              collectionStore.rows(collection),
              request.query,
            )
          : [],
      choices: definition
        ? Object.fromEntries(
            definition.fields
              .filter(
                (f) => f.type === "relationship" || f.control === "reference",
              )
              .map((f) => [
                f.name,
                collectionStore
                  .rows(f.target)
                  .filter((row) => this.allowOption(row, f.optionRule)),
              ]),
          )
        : {},
      errors: request.formErrors || {},
      hasErrors: Boolean(request.flash?.error),
      pageTitle: definition
        ? `${recordId ? "Edit " : isNew ? "Add " : ""}${recordId || isNew ? definition.singularLabel : definition.label}`
        : {
            schema: "Database Schema",
            views: "Data Views",
            records: "Collections",
          }[mode],
      mode,
      csrf: request.session.schemaCsrf,
    });
  }
  allowOption(row, rule) {
    if (rule === "kaiden-color")
      return (
        isKaiden(row) &&
        row.dalmaterColorName?.trim() &&
        normalizeHex(row.dalmaterColorHex)
      );
    return rule !== "kaiden" || isKaiden(row);
  }
  filterLegacy(collection, rows, query) {
    if (collection === "members" && query.council === "current")
      return currentCouncilMembers(rows);
    if (collection === "members" && query.council === "all")
      return councilMembers(rows);
    if (
      collection === "updates" &&
      ["general", "council", "news"].includes(query.category)
    )
      return rows.filter((row) => row.category === query.category);
    return rows;
  }
  async save(request, reply) {
    const collection = request.collection || request.params.collection;
    const id = request.params.id;
    const old = id
      ? collectionStore.rows(collection).find((r) => r.id === id)
      : null;
    if (id && !old) return reply.code(404).send("Record not found.");
    let uploaded, imageService;
    try {
      const definition = collectionStore.definition(collection);
      const generated = request.body?._generated === "true";
      const design = request.body?._design === "true";
      if (design && !definition.capabilities?.design)
        throw new Error("This collection does not support design editing.");
      let record = generated
        ? readGeneratedForm(definition, request.body)
        : readLegacyForm(collection, request.body, old);
      if (design) {
        const draft = readLegacyForm("pages", request.body, old);
        draft[definition.contentField || "content"] = draft.content;
        // Relationship fields post as multi/single-selects on the design form too.
        for (const field of definition.fields)
          if (
            field.type === "relationship" &&
            request.body[field.name] !== undefined
          )
            draft[field.name] = request.body[field.name];
        record = Object.fromEntries(
          Object.entries(draft).filter(([key]) =>
            definition.fields.some((field) => field.name === key),
          ),
        );
      }
      if (
        !generated &&
        !design &&
        ["members", "updates"].includes(collection)
      ) {
        imageService =
          collection === "members" ? memberImageService : updateImageService;
        uploaded = await imageService.save(request.body?.image);
        record.image = uploaded || old?.image || "";
      }
      const saved = await collectionStore.saveRecord(
        collection,
        record,
        id,
        generated,
      );
      request.session.adminFlash = {
        success: `${collection === "pages" ? "Page" : "Record"} ${id ? "updated" : "created"} successfully`,
      };
      return reply.redirect(
        `/admin/collections/${encodeURIComponent(collection)}/${saved.id}/edit`,
      );
    } catch (error) {
      if (uploaded)
        await imageService.discard(uploaded).catch((e) => request.log.error(e));
      request.formRecord = Object.fromEntries(
        Object.entries(request.body || {})
          .filter(
            ([key, value]) => !key.startsWith("_") && value?.type !== "file",
          )
          .map(([key, value]) => [
            key,
            value?.type === "field" ? value.value : value,
          ]),
      );
      const submitted = request.formRecord;
      request.formRecord = {
        ...old,
        ...submitted,
        ...(old?.image ? { image: old.image } : {}),
      };
      for (const field of collectionStore.definition(collection).fields)
        if (field.type === "boolean")
          request.formRecord[field.name] =
            submitted[field.name] === true || submitted[field.name] === "on";
      if (collection === "updates" && request.formRecord.content !== undefined)
        request.formRecord.body = request.formRecord.content;
      request.formErrors = error.fields || {};
      request.flash = { error: error.message };
      reply.code(400);
      return this.screen(request, reply);
    }
  }
  async remove(request, reply) {
    const collection = request.collection || request.params.collection;
    try {
      await collectionStore.deleteRecord(collection, request.params.id);
      return reply.redirect(
        `/admin/collections/${encodeURIComponent(collection)}`,
      );
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  }
  async reorder(request, reply) {
    try {
      const definition =
        request.collectionDefinition ||
        collectionStore.definition(
          request.collection || request.params.collection,
        );
      if (!definition.orderField)
        throw new Error("Ordering is not configured for this collection.");
      await collectionStore.reorder(
        definition.id,
        request.body?.ids,
        definition.orderField,
      );
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  }
  async upload(request, reply) {
    try {
      return reply.send(
        await uploadCollectionMedia(request.body.file || request.body.media),
      );
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
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
          const source = collectionStore.data();
          const data =
            ["kaiden", "kaiden-color"].includes(request.query.optionRule) &&
            definition.id === "members"
              ? {
                  ...source,
                  members: (source.members || []).filter((row) =>
                    this.allowOption(row, request.query.optionRule),
                  ),
                }
              : source;
          return queryView(
            data,
            {
              id: "admin_list",
              name: "Records",
              collection: definition.id,
              fields,
              pageSize: 20,
              ...(definition.orderField
                ? { sort: [{ field: definition.orderField, direction: "asc" }] }
                : {}),
            },
            request.query,
          );
        }
        if (action === "record") {
          const def = collectionStore.definition(request.query.collection);
          if (def.locked)
            throw new Error(
              "Use protected authentication/settings administration.",
            );
          const record = collectionStore
            .rows(def.id)
            .find((r) => r.id === request.query.id);
          if (!record)
            return reply.code(404).send({ error: "Record not found." });
          return Object.fromEntries(
            Object.entries(record).map(([key, value]) => [
              key,
              def.fields.some((f) => f.name === key && f.type === "richtext") &&
              typeof value === "string"
                ? sanitizePageContent(value)
                : value,
            ]),
          );
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
        if (action === "move-record") {
          const def = collectionStore.definition(body.collection);
          if (
            def.locked ||
            !def.orderField ||
            (![-1, 1].includes(body.delta) && typeof body.beforeId !== "string")
          )
            throw new Error("Invalid ordering request.");
          const ids = [...collectionStore.rows(def.id)]
            .sort((a, b) => (a[def.orderField] ?? 0) - (b[def.orderField] ?? 0))
            .map((row) => row.id);
          const index = ids.indexOf(body.id),
            target = body.beforeId
              ? ids.indexOf(body.beforeId)
              : index + body.delta;
          if (index < 0) throw new Error("Record not found.");
          if (target >= 0 && target < ids.length) {
            if (body.beforeId) {
              if (body.beforeId !== body.id) {
                ids.splice(index, 1);
                ids.splice(ids.indexOf(body.beforeId), 0, body.id);
              }
            } else [ids[index], ids[target]] = [ids[target], ids[index]];
            await collectionStore.reorder(def.id, ids, def.orderField);
          }
          return { success: true };
        }
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
          return await uploadCollectionMedia(request.body.file);
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
