import {
  Controller,
  Route,
  Tags,
  Get,
  Put,
  Delete,
  Path,
  Body,
  Security,
  Request,
} from "tsoa";
import { userService } from "../service/userService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserResponse, UserUpdateRequest } from "../model/types";

@Route("users")
@Tags("Users")
export class UsersController extends Controller {
  @Get()
  @Security("jwt")
  public async list(): Promise<UserResponse[]> {
    const users = await userService.list();
    return users as UserResponse[];
  }

  @Get("{id}")
  @Security("jwt")
  public async getById(@Path() id: number): Promise<UserResponse> {
    const user = await userService.getById(id);
    if (!user) {
      this.setStatus(404);
      throw new Error("User not found");
    }
    return user as UserResponse;
  }

  @Put("{id}")
  @Security("jwt")
  public async update(
    @Path() id: number,
    @Body() body: UserUpdateRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserResponse> {
    if (req.user!.userId !== id) {
      this.setStatus(403);
      throw new Error("Cannot update another user");
    }
    const updated = await userService.update(id, body);
    if (!updated) {
      this.setStatus(404);
      throw new Error("User not found");
    }
    return updated as UserResponse;
  }

  @Delete("{id}")
  @Security("jwt")
  public async softDelete(
    @Path() id: number,
  ): Promise<{ message: string }> {
    const deleted = await userService.softDelete(id);
    if (!deleted) {
      this.setStatus(404);
      throw new Error("User not found");
    }
    return { message: "User deleted" };
  }
}
