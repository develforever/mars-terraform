import jwt from "jsonwebtoken";
import { TOKEN_AUDIENCE } from "../service/authService";

/** Token JWT jak z `authService.generateToken` (T13: z `aud`), do testów HTTP z mockowanym `config`. */
export const signTestToken = (userId: number, secret = "test-secret"): string =>
  jwt.sign({ userId }, secret, { expiresIn: "1h", audience: TOKEN_AUDIENCE });
