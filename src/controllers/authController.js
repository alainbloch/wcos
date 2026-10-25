/**
 * Auth Controller
 * Handles login, logout, registration
 */
import { BaseController } from "./baseController.js";
import { originalPages } from "../services/referenceSiteService.js";
import { authService } from "../services/authService.js";

export class AuthController extends BaseController {
  async loginForm(request, reply) {
    if (request.user) {
      return reply.redirect("/admin");
    }
    await this.render(request, reply, "auth/login.njk", {
      pageTitle: "Login",
      page: originalPages.find((page) => page.slug === ""),
    });
  }

  async login(request, reply) {
    const { email, password } = request.body;

    try {
      const { user, token } = await authService.authenticate(email, password);

      reply.setCookie("wcos_session", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      request.flash = { success: "Welcome back!" };
      reply.redirect("/admin");
    } catch (error) {
      request.flash = { error: error.message };
      reply.redirect("/login");
    }
  }

  async logout(request, reply) {
    reply.clearCookie("wcos_session", { path: "/" });
    request.flash = { success: "Logged out successfully" };
    reply.redirect("/login");
  }
}

export const authController = new AuthController();
