/** Stable source URLs and CMS routes, with compatibility redirects for the first conversion. */
import { authController } from "../controllers/authController.js";
import { referenceSiteController as site } from "../controllers/referenceSiteController.js";
import { contactController } from "../controllers/contactController.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";

export async function publicRoutes(fastify) {
  fastify.addHook("preHandler", optionalAuthMiddleware);

  // Home page
  fastify.get("/", async (request, reply) => {
    // Preserve WordPress-style search links independently of CMS page rendering.
    if (request.query.s)
      return reply.redirect(`/search?q=${encodeURIComponent(request.query.s)}`);
    return site.page(request, reply);
  });

  // Search
  fastify.get("/search", async (request, reply) => {
    await site.search(request, reply);
  });

  // Contact form
  fastify.post("/contact", async (request, reply) => {
    await contactController.send(request, reply);
  });

  // Redirects for old slugs
  for (const [from, to] of Object.entries({
    "contact-us": "contact",
    "previous-updates": "updates",
  })) {
    fastify.get(`/${from}`, async (_request, reply) =>
      reply.code(301).redirect(`/${to}`),
    );
  }

  // Photo gallery redirects to SmugMug
  fastify.get("/photo-gallery", async (_request, reply) =>
    reply.redirect("https://westerncircle.smugmug.com/"),
  );

  // Category redirects to news
  fastify.get("/category/:category", async (_request, reply) =>
    reply.redirect("/news"),
  );

  // Auth routes
  fastify.get("/login", async (request, reply) => {
    await authController.loginForm(request, reply);
  });
  fastify.post("/login", async (request, reply) => {
    await authController.login(request, reply);
  });
  fastify.get("/logout", async (request, reply) => {
    await authController.logout(request, reply);
  });
  fastify.get("/register", async (request, reply) => {
    await authController.registerForm(request, reply);
  });
  fastify.post("/register", async (request, reply) => {
    await authController.register(request, reply);
  });

  // All published CMS pages, including category and member pages, share one renderer.
  fastify.get("/:slug", async (request, reply) => {
    await site.page(request, reply);
  });
}
