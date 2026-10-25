/**
 * Authentication Middleware
 */
import { authService } from "../services/authService.js";

export async function authMiddleware(request, reply) {
  const token = request.cookies?.wcos_session;

  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }

  const user = await authService.getUserById(decoded.id);
  if (!user || (decoded.authVersion || 0) !== (user.authVersion || 0)) {
    return reply.code(401).send({ error: "User not found" });
  }

  request.user = user;
}

export async function optionalAuthMiddleware(request, reply) {
  const token = request.cookies?.wcos_session;

  if (token) {
    const decoded = authService.verifyToken(token);
    if (decoded) {
      const user = await authService.getUserById(decoded.id);
      if (user && (decoded.authVersion || 0) === (user.authVersion || 0)) {
        request.user = user;
      }
    }
  }
}

export function requireRole(...roles) {
  return async function (request, reply) {
    await authMiddleware(request, reply);

    if (reply.sent) return;

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }
  };
}
