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
} from "tsoa";
import { HttpError } from "../errors/HttpError";
import { groupService } from "../service/groupService";
import { GroupResponse, CreateGroupRequest, AddMemberRequest } from "../model/types";

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
  public async create(@Body() body: CreateGroupRequest): Promise<GroupResponse> {
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
  ): Promise<{ message: string }> {
    await groupService.addUser(body.userId, id);
    return { message: "Member added" };
  }

  @Delete("{id}/members/{userId}")
  @Security("jwt")
  public async removeMember(
    @Path() id: number,
    @Path() userId: number,
  ): Promise<{ message: string }> {
    await groupService.removeUser(userId, id);
    return { message: "Member removed" };
  }
}
