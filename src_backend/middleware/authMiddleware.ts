import { Request } from "express";
import { authService, JwtPayload } from "../service/authService";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[],
): Promise<JwtPayload> {
  if (securityName !== "jwt") {
    return Promise.reject(new Error("Unknown security scheme"));
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Promise.reject(new Error("Missing or invalid Authorization header"));
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);
    (request as AuthenticatedRequest).user = payload;
    return Promise.resolve(payload);
  } catch {
    return Promise.reject(new Error("Invalid or expired token"));
  }
}
