import { BaseController } from "./baseController.js";
import { usersController } from "./usersController.js";
import { sha } from "../services/dataTransfer/format.js";
import {
  applyImport,
  exportData,
  stageImport,
  listBackups,
  readBackup,
  getPreview,
  cleanStages,
} from "../services/dataTransfer/service.js";
export class DataTransferController extends BaseController {
  owner(request) {
    return sha(`${request.user.id}:${request.session.userCsrf}`);
  }
  async guard(request, reply) {
    if (Buffer.isBuffer(request.body)) {
      const body = request.body;
      request.body = { _csrf: request.headers["x-transfer-csrf"] };
      await usersController.guard(request, reply);
      request.body = body;
    } else await usersController.guard(request, reply);
  }
  async page(request, reply, report = null, error = null) {
    await cleanStages();
    return this.renderAdmin(request, reply, "admin/data-transfer.njk", {
      pageTitle: "Data Transfer",
      csrf: request.session.userCsrf,
      report,
      backups: await listBackups(),
      ...(error ? { flash: { error } } : {}),
    });
  }
  async export(request, reply) {
    const archive = request.params.format === "zip";
    if (!archive && request.params.format !== "json")
      return reply.code(404).send("Unknown export format.");
    try {
      const bytes = await exportData(archive);
      return reply
        .header(
          "Content-Disposition",
          `attachment; filename="wcos-backup-${new Date().toISOString().slice(0, 10)}.${archive ? "zip" : "json"}"`,
        )
        .type(archive ? "application/zip" : "application/json")
        .send(bytes);
    } catch (error) {
      reply.code(400);
      return this.page(request, reply, null, error.message);
    }
  }
  async upload(request, reply) {
    try {
      if (
        !Buffer.isBuffer(request.body) ||
        !["json", "zip"].includes(request.headers["x-transfer-format"])
      )
        throw new Error("Choose a JSON or ZIP backup.");
      const report = await stageImport(
        request.body,
        request.headers["x-transfer-format"] === "zip",
        request.headers["x-transfer-mode"],
        this.owner(request),
      );
      return reply.send({
        location: `/admin/settings/data-transfer/preview/${report.token}`,
      });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  }
  async preview(request, reply) {
    try {
      return await this.page(
        request,
        reply,
        await getPreview(request.params.token, this.owner(request)),
      );
    } catch {
      reply.code(400);
      return this.page(
        request,
        reply,
        null,
        "Preview expired or unavailable. Upload the file again.",
      );
    }
  }
  async apply(request, reply) {
    if (request.body?.confirm !== "yes") {
      reply.code(400);
      return this.page(
        request,
        reply,
        null,
        "Confirm the import before proceeding.",
      );
    }
    try {
      const { backupName } = await applyImport(
        request.body.token,
        this.owner(request),
      );
      request.session.adminFlash = {
        success: `Import completed. Recovery archive: ${backupName}. Sign in with an account from the resulting database.`,
      };
      reply.clearCookie("wcos_session", { path: "/" });
      return reply.redirect("/login");
    } catch (error) {
      reply.code(400);
      return this.page(request, reply, null, error.message);
    }
  }
  async backup(request, reply) {
    try {
      return reply
        .header(
          "Content-Disposition",
          `attachment; filename="${request.params.name}"`,
        )
        .type("application/zip")
        .send(await readBackup(request.params.name));
    } catch {
      return reply.code(404).send("Backup not found.");
    }
  }
}
export const dataTransferController = new DataTransferController();
