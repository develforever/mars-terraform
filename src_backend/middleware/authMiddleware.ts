import { Request } from "express";
import { authService, JwtPayload } from "../service/authService";
import { HttpError } from "../errors/HttpError";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[],
): Promise<JwtPayload> {
  void _scopes;
  if (securityName !== "jwt") {
    // Błąd konfiguracji kontrolera, nie klienta (TSOA i tak nadaje mu 401, patrz routes.ts).
    return Promise.reject(new Error("Unknown security scheme"));
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Promise.reject(new HttpError(401, "Missing or invalid Authorization header"));
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);
    (request as AuthenticatedRequest).user = payload;
    return Promise.resolve(payload);
  } catch {
    return Promise.reject(new HttpError(401, "Invalid or expired token"));
  }
}
