/**
 * Public Routes
 * Front-end website routes
 */
import { homeController } from '../controllers/homeController.js';
import { whoWeAreController } from '../controllers/whoWeAreController.js';
import { knowledgeBaseController } from '../controllers/knowledgeBaseController.js';
import { involvementController } from '../controllers/involvementController.js';
import { resourcesController } from '../controllers/resourcesController.js';
import { authController } from '../controllers/authController.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

export async function publicRoutes(fastify) {
  // Apply optional auth to all routes
  fastify.addHook('preHandler', optionalAuthMiddleware);

  // Home
  fastify.get('/', homeController.index.bind(homeController));

  // Who We Are
  fastify.get('/member-profiles', whoWeAreController.memberProfiles.bind(whoWeAreController));
  fastify.get('/photo-gallery', whoWeAreController.photoGallery.bind(whoWeAreController));
  fastify.get('/wcos-council', whoWeAreController.wcosCouncil.bind(whoWeAreController));
  fastify.get('/hall-of-heroes', whoWeAreController.hallOfHeroes.bind(whoWeAreController));

  // Knowledge Base
  fastify.get('/rank-requirements', knowledgeBaseController.rankRequirements.bind(knowledgeBaseController));
  fastify.get('/core-moves', knowledgeBaseController.coreMoves.bind(knowledgeBaseController));
  fastify.get('/dalmater-colors', knowledgeBaseController.dalmaterColors.bind(knowledgeBaseController));
  fastify.get('/kaidens', knowledgeBaseController.kaidens.bind(knowledgeBaseController));
  fastify.get('/fighter-class', knowledgeBaseController.fighterClass.bind(knowledgeBaseController));
  fastify.get('/armor', knowledgeBaseController.armor.bind(knowledgeBaseController));
  fastify.get('/weapons', knowledgeBaseController.weapons.bind(knowledgeBaseController));
  fastify.get('/sparring', knowledgeBaseController.sparring.bind(knowledgeBaseController));
  fastify.get('/sword-dance', knowledgeBaseController.swordDance.bind(knowledgeBaseController));
  fastify.get('/glossary', knowledgeBaseController.glossary.bind(knowledgeBaseController));

  // Involvement
  fastify.get('/classes', involvementController.classes.bind(involvementController));
  fastify.get('/wcos-etiquette-rules', involvementController.etiquetteRules.bind(involvementController));
  fastify.get('/dues', involvementController.dues.bind(involvementController));

  // Resources
  fastify.get('/links-resources', resourcesController.linksResources.bind(resourcesController));
  fastify.get('/contact-us', resourcesController.contactUs.bind(resourcesController));
  fastify.get('/previous-updates', resourcesController.previousUpdates.bind(resourcesController));

  // Auth
  fastify.get('/login', authController.loginForm.bind(authController));
  fastify.post('/login', authController.login.bind(authController));
  fastify.get('/logout', authController.logout.bind(authController));
  fastify.get('/register', authController.registerForm.bind(authController));
  fastify.post('/register', authController.register.bind(authController));
}