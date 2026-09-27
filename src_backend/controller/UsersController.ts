import {
  Controller,
  Route,
  Tags,
  Put,
  Delete,
  Body,
  Security,
  Request,
} from "@tsoa/runtime";
import { HttpError } from "../errors/HttpError";
import { userService } from "../service/userService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserResponse, UserUpdateRequest } from "../model/types";

/**
 * Konto zalogowanego użytkownika (T11). Wszystkie operacje dotyczą WYŁĄCZNIE konta z tokenu JWT:
 * brak listy użytkowników i brak dostępu po `id` (wcześniej każdy zalogowany widział e-maile wszystkich
 * i mógł usunąć dowolne konto). Odczyt własnego profilu: `GET /api/auth/me`.
 */
@Route("users")
@Tags("Users")
export class UsersController extends Controller {
  @Put("me")
  @Security("jwt")
  public async updateMe(
    @Body() body: UserUpdateRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserResponse> {
    const userId = req.user!.userId;
    const updated = await userService.update(userId, body);
    if (!updated) {
      throw new HttpError(404, "User not found");
    }
    // Odpowiedź tylko z publicznych pól profilu (bez provider_id, deleted_at itp.).
    const user = await userService.getById(userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    return user as UserResponse;
  }

  @Delete("me")
  @Security("jwt")
  public async deleteMe(@Request() req: AuthenticatedRequest): Promise<{ message: string }> {
    const deleted = await userService.softDelete(req.user!.userId);
    if (!deleted) {
      throw new HttpError(404, "User not found");
    }
    return { message: "User deleted" };
  }
}
