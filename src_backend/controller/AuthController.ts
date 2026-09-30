import { Controller, Route, Tags, Post, Get, Body, Request, Security } from "@tsoa/runtime";
import { HttpError } from "../errors/HttpError";
import { authService } from "../service/authService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  AuthResponse,
  LoginRequest,
  RegisterResponse,
  TotpCodeRequest,
  TotpSetupResponse,
  UserResponse,
} from "../model/types";

/**
 * Konta bez danych osobowych (T13, D17): numer konta + opcjonalny authenticator (TOTP).
 * Brak e-maila, hasła, OAuth i wysyłki wiadomości. Serwer nie zapisuje adresów IP.
 */
@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  /** Tworzy konto i od razu loguje. `accountNumber` jest zwracany tylko tutaj i nie da się go odzyskać. */
  @Post("register")
  public async register(): Promise<RegisterResponse> {
    this.setStatus(201);
    this.setHeader("Cache-Control", "no-store");
    return authService.register();
  }

  @Post("login")
  public async login(@Body() body: LoginRequest): Promise<AuthResponse> {
    this.setHeader("Cache-Control", "no-store");
    return authService.login(body.accountNumber, body.totpCode);
  }

  @Get("me")
  @Security("jwt")
  public async me(@Request() req: AuthenticatedRequest): Promise<UserResponse> {
    const user = await authService.me(req.user!.userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    return user;
  }

  /** Krok 1 włączenia authenticatora: sekret do dodania w aplikacji (jeszcze nieaktywny). */
  @Post("totp/setup")
  @Security("jwt")
  public async totpSetup(@Request() req: AuthenticatedRequest): Promise<TotpSetupResponse> {
    this.setHeader("Cache-Control", "no-store");
    return authService.totpSetup(req.user!.userId);
  }

  /** Krok 2: aktywacja po podaniu poprawnego kodu z aplikacji. */
  @Post("totp/enable")
  @Security("jwt")
  public async totpEnable(
    @Body() body: TotpCodeRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await authService.totpEnable(req.user!.userId, body.code);
    return { message: "Authenticator enabled" };
  }

  /** Wyłączenie wymaga aktualnego kodu z aplikacji. */
  @Post("totp/disable")
  @Security("jwt")
  public async totpDisable(
    @Body() body: TotpCodeRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await authService.totpDisable(req.user!.userId, body.code);
    return { message: "Authenticator disabled" };
  }
}
