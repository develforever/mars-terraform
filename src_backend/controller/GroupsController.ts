import {
  Controller,
  Route,
  Tags,
  Get,
  Post,
  Delete,
  Path,
  Body,
  Security,
  Request,
} from "@tsoa/runtime";
import { HttpError } from "../errors/HttpError";
import { ADMIN_GROUP_NAME, groupService } from "../service/groupService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { GroupResponse, CreateGroupRequest, AddMemberRequest } from "../model/types";

/**
 * Grupy (T11). Odczyt nazw grup: każdy zalogowany. Tworzenie grup i zarządzanie członkami:
 * tylko członkowie grupy `admin` (wcześniej każdy zalogowany mógł dopisać/usunąć dowolnego użytkownika
 * z dowolnej grupy, w tym nadać sobie uprawnienia). Pierwszego admina dodaje się ręcznie w bazie.
 */
@Route("groups")
@Tags("Groups")
export class GroupsController extends Controller {
  @Get()
  @Security("jwt")
  public async list(): Promise<GroupResponse[]> {
    const groups = await groupService.list();
    return groups as GroupResponse[];
  }

  @Post()
  @Security("jwt")
  public async create(
    @Body() body: CreateGroupRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<GroupResponse> {
    await this.requireAdmin(req);
    const group = await groupService.create(body.name, body.description);
    return group as GroupResponse;
  }

  @Get("{id}")
  @Security("jwt")
  public async getById(@Path() id: number): Promise<GroupResponse> {
    const group = await groupService.getById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }
    return group as GroupResponse;
  }

  @Post("{id}/members")
  @Security("jwt")
  public async addMember(
    @Path() id: number,
    @Body() body: AddMemberRequest,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.requireAdmin(req);
    await groupService.addUser(body.userId, id);
    return { message: "Member added" };
  }

  @Delete("{id}/members/{userId}")
  @Security("jwt")
  public async removeMember(
    @Path() id: number,
    @Path() userId: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.requireAdmin(req);
    await groupService.removeUser(userId, id);
    return { message: "Member removed" };
  }

  private async requireAdmin(req: AuthenticatedRequest): Promise<void> {
    const isAdmin = await groupService.isMemberOf(req.user!.userId, ADMIN_GROUP_NAME);
    if (!isAdmin) {
      throw new HttpError(403, "Admin rights required");
    }
  }
}
