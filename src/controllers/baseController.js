/**
 * Base Controller
 * Provides common functionality for all controllers
 */
import { siteService } from "../services/siteService.js";
import { renderView } from "../utils/viewEngine.js";

export class BaseController {
  constructor() {
    this.siteService = siteService;
  }

  async render(request, reply, template, additionalContext = {}) {
    const footerData = await this.siteService.getFooterData();
    const flash = request.flash ||
      request.session?.adminFlash || { success: null, error: null };
    if (request.session) delete request.session.adminFlash;

    const context = {
      request: {
        ...request,
        path: request.url,
      },
      user: request.user || null,
      flash,
      ...footerData,
      ...additionalContext,
    };

    const html = await renderView(request.server, template, context);
    reply.type("text/html").send(html);
  }

  async renderAdmin(request, reply, template, additionalContext = {}) {
    const footerData = await this.siteService.getFooterData();
    const flash = request.flash ||
      request.session?.adminFlash || { success: null, error: null };
    if (request.session) delete request.session.adminFlash;

    const context = {
      request: {
        ...request,
        path: request.url,
      },
      user: request.user,
      flash,
      ...footerData,
      isAdmin: true,
      ...additionalContext,
    };

    const html = await renderView(request.server, template, context);
    reply.type("text/html").send(html);
  }

  jsonSuccess(reply, data, statusCode = 200) {
    reply.code(statusCode).send({ success: true, data });
  }

  jsonError(reply, message, statusCode = 400, errors = null) {
    reply.code(statusCode).send({
      success: false,
      error: { message, errors },
    });
  }
}
