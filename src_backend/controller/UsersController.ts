import {
  Controller,
  Route,
  Tags,
  Get,
  Put,
  Delete,
  Body,
  Security,
  Request,
} from "@tsoa/runtime";
import { HttpError } from "../errors/HttpError";
import { userService } from "../service/userService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserDataExport, UserResponse, UserUpdateRequest } from "../model/types";

/**
 * Konto zalogowanego użytkownika. Wszystkie operacje dotyczą WYŁĄCZNIE konta z tokenu JWT (T11):
 * brak listy użytkowników i brak dostępu po `id`. Odczyt własnego profilu: `GET /api/auth/me`.
 * T12 (RODO): eksport wszystkich danych i trwałe usunięcie konta.
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
    const name = body.name.trim();
    if (name.length === 0) {
      throw new HttpError(400, "Name must not be empty");
    }
    const userId = req.user!.userId;
    const updated = await userService.update(userId, { name });
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

  /** RODO art. 15 i 20: wszystkie dane konta w JSON (bez hasła i tokenów), jako plik do pobrania. */
  @Get("me/export")
  @Security("jwt")
  public async exportMe(@Request() req: AuthenticatedRequest): Promise<UserDataExport> {
    const data = await userService.exportData(req.user!.userId);
    if (!data) {
      throw new HttpError(404, "User not found");
    }
    this.setHeader("Content-Disposition", 'attachment; filename="mars-terraform-my-data.json"');
    this.setHeader("Cache-Control", "no-store");
    return data as UserDataExport;
  }

  /**
   * RODO art. 17: trwałe usunięcie konta z koloniami, mapami, metodami logowania, członkostwem w grupach
   * i tokenami. Nieodwracalne. Wydany JWT wygasa sam (domyślnie po 1 h) i nie ma już czego odczytać.
   */
  @Delete("me")
  @Security("jwt")
  public async deleteMe(@Request() req: AuthenticatedRequest): Promise<{ message: string }> {
    const deleted = await userService.deleteAccount(req.user!.userId);
    if (!deleted) {
      throw new HttpError(404, "User not found");
    }
    return { message: "Account and all related data deleted" };
  }
}
