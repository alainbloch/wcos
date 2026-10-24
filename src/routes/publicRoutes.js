/** Stable source URLs and CMS routes, with compatibility redirects for the first conversion. */
import { authController } from "../controllers/authController.js";
import { referenceSiteController as site } from "../controllers/referenceSiteController.js";
import { contactController } from "../controllers/contactController.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";

export async function publicRoutes(fastify) {
  fastify.addHook("preHandler", optionalAuthMiddleware);
  fastify.get("/", site.page.bind(site));
  fastify.get("/search", site.search.bind(site));
  fastify.post("/contact", contactController.send.bind(contactController));
  for (const [from, to] of Object.entries({
    "contact-us": "contact",
    "previous-updates": "updates",
  })) {
    fastify.get(`/${from}`, async (_request, reply) =>
      reply.code(301).redirect(`/${to}`),
    );
  }
  fastify.get("/photo-gallery", async (_request, reply) =>
    reply.redirect("https://westerncircle.smugmug.com/"),
  );
  fastify.get("/category/:category", async (_request, reply) =>
    reply.redirect("/news"),
  );
  fastify.get("/login", authController.loginForm.bind(authController));
  fastify.post("/login", authController.login.bind(authController));
  fastify.get("/logout", authController.logout.bind(authController));
  fastify.get("/register", authController.registerForm.bind(authController));
  fastify.post("/register", authController.register.bind(authController));
  fastify.get("/:slug", site.page.bind(site));
}
