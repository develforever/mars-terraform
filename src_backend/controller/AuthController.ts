import {
  Controller,
  Route,
  Tags,
  Post,
  Get,
  Body,
  Request,
  Security,
} from "tsoa";
import { authService } from "../service/authService";
import { userService } from "../service/userService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  AuthResponse,
  UserResponse,
} from "../model/types";

@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  @Post("register")
  public async register(
    @Body() body: RegisterRequest,
  ): Promise<UserResponse> {
    const user = await authService.registerLocal(body.email, body.password, body.name);
    return { id: user.id, email: user.email, name: "", authProvider: "local", createdAt: null };
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
      this.setStatus(404);
      throw new Error("User not found");
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
}
