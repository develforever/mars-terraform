import {
  Controller,
  Route,
  Tags,
  Post,
  Get,
  Body,
  Request,
  Security,
  Query,
} from "tsoa";
import { HttpError } from "../errors/HttpError";
import { authService } from "../service/authService";
import { userService } from "../service/userService";
import { oauthService } from "../service/oauthService";
import { config } from "../config";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  AuthResponse,
  UserResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
} from "../model/types";

@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  @Post("register")
  public async register(
    @Body() body: RegisterRequest,
  ): Promise<{ message: string; userId: number; email: string }> {
    const user = await authService.registerLocal(body.email, body.password, body.name);
    return { message: "Registration successful. Please check your email to verify your account.", userId: user.id, email: user.email };
  }

  @Post("login")
  public async login(@Body() body: LoginRequest): Promise<AuthResponse> {
    const result = await authService.loginLocal(body.email, body.password);
    return result;
  }

  @Get("me")
  @Security("jwt")
  public async me(@Request() req: AuthenticatedRequest): Promise<UserResponse> {
    const user = await userService.getById(req.user!.userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    return user as UserResponse;
  }

  @Post("change-password")
  @Security("jwt")
  public async changePassword(
    @Body() body: ChangePasswordRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await authService.changePassword(req.user!.userId, body.oldPassword, body.newPassword);
    return { message: "Password changed successfully" };
  }

  @Post("forgot-password")
  public async forgotPassword(@Body() body: ForgotPasswordRequest): Promise<{ message: string }> {
    await authService.requestPasswordReset(body.email);
    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  @Post("reset-password")
  public async resetPassword(@Body() body: ResetPasswordRequest): Promise<{ message: string }> {
    await authService.resetPassword(body.token, body.newPassword);
    return { message: "Password has been reset successfully." };
  }

  @Post("verify-email")
  public async verifyEmail(@Body() body: VerifyEmailRequest): Promise<{ message: string }> {
    await authService.verifyEmail(body.token);
    return { message: "Email verified successfully." };
  }

  @Post("resend-verification")
  public async resendVerification(@Body() body: ResendVerificationRequest): Promise<{ message: string }> {
    await authService.resendVerification(body.email);
    return { message: "Verification email has been sent." };
  }

  @Get("providers")
  public async providers(): Promise<{ google: boolean; github: boolean }> {
    return {
      google: !!(config.googleClientId && config.googleClientSecret),
      github: !!(config.githubClientId && config.githubClientSecret),
    };
  }

  @Get("google")
  public async googleAuth(): Promise<{ url: string }> {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new HttpError(404, "Google authentication is not configured");
    }

    const url = oauthService.getGoogleAuthUrl();
    return { url };
  }

  @Get("google/callback")
  public async googleCallback(@Query() code: string): Promise<void> {
    const userInfo = await oauthService.exchangeGoogleCode(code);
    const result = await oauthService.findOrCreateUser("google", userInfo);
    this.setStatus(302);
    this.setHeader("Location", `${config.frontendUrl}/?token=${result.token}`);
    return;
  }

  @Get("github")
  public async githubAuth(): Promise<{ url: string }> {
    if (!config.githubClientId || !config.githubClientSecret) {
      throw new HttpError(404, "GitHub authentication is not configured");
    }

    const url = oauthService.getGithubAuthUrl();
    return { url };
  }

  @Get("github/callback")
  public async githubCallback(@Query() code: string): Promise<void> {
    const userInfo = await oauthService.exchangeGithubCode(code);
    const result = await oauthService.findOrCreateUser("github", userInfo);
    this.setStatus(302);
    this.setHeader("Location", `${config.frontendUrl}/?token=${result.token}`);
    return;
  }
}
