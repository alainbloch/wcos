/** Stable source URLs and CMS routes, with compatibility redirects for the first conversion. */
import { authController } from "../controllers/authController.js";
import { referenceSiteController as site } from "../controllers/referenceSiteController.js";
import { contactController } from "../controllers/contactController.js";
import { whoWeAreController } from "../controllers/whoWeAreController.js";
import { knowledgeBaseController } from "../controllers/knowledgeBaseController.js";
import { involvementController } from "../controllers/involvementController.js";
import { resourcesController } from "../controllers/resourcesController.js";
import { homeController } from "../controllers/homeController.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";

export async function publicRoutes(fastify) {
  fastify.addHook("preHandler", optionalAuthMiddleware);

  // Home page
  fastify.get("/", async (request, reply) => {
    await homeController.index(request, reply);
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
  fastify.get(
    "/photo-gallery",
    whoWeAreController.photoGallery.bind(whoWeAreController),
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

  // Who We Are pages
  // fastify.get("/member-profiles", async (request, reply) => {
  //   await whoWeAreController.memberProfiles(request, reply);
  // });
  fastify.get("/wcos-council", async (request, reply) => {
    await whoWeAreController.wcosCouncil(request, reply);
  });
  fastify.get("/hall-of-heroes", async (request, reply) => {
    await whoWeAreController.hallOfHeroes(request, reply);
  });

  // Knowledge Base pages
  fastify.get("/rank-requirements", async (request, reply) => {
    await knowledgeBaseController.rankRequirements(request, reply);
  });
  fastify.get("/core-moves", async (request, reply) => {
    await knowledgeBaseController.coreMoves(request, reply);
  });
  fastify.get("/dalmater-colors", async (request, reply) => {
    await knowledgeBaseController.dalmaterColors(request, reply);
  });
  fastify.get("/kaidens", async (request, reply) => {
    await knowledgeBaseController.kaidens(request, reply);
  });
  fastify.get("/fighter-class", async (request, reply) => {
    await knowledgeBaseController.fighterClass(request, reply);
  });
  fastify.get("/armor", async (request, reply) => {
    await knowledgeBaseController.armor(request, reply);
  });
  fastify.get("/weapons", async (request, reply) => {
    await knowledgeBaseController.weapons(request, reply);
  });
  fastify.get("/sparring", async (request, reply) => {
    await knowledgeBaseController.sparring(request, reply);
  });
  fastify.get("/sword-dance", async (request, reply) => {
    await knowledgeBaseController.swordDance(request, reply);
  });
  fastify.get("/glossary", async (request, reply) => {
    await knowledgeBaseController.glossary(request, reply);
  });

  // Involvement pages
  fastify.get("/classes", async (request, reply) => {
    await involvementController.classes(request, reply);
  });
  fastify.get("/wcos-etiquette-rules", async (request, reply) => {
    await involvementController.etiquetteRules(request, reply);
  });
  fastify.get("/dues", async (request, reply) => {
    await involvementController.dues(request, reply);
  });

  // Resources pages
  fastify.get("/links-resources", async (request, reply) => {
    await resourcesController.linksResources(request, reply);
  });
  fastify.get("/contact", async (request, reply) => {
    await resourcesController.contactUs(request, reply);
  });
  fastify.get("/news", async (request, reply) => {
    await resourcesController.news(request, reply);
  });
  fastify.get("/updates", async (request, reply) => {
    await resourcesController.previousUpdates(request, reply);
  });

  // Fallback to reference site for any other page (dynamic pages from CMS)
  fastify.get("/:slug", async (request, reply) => {
    await site.page(request, reply);
  });
}
