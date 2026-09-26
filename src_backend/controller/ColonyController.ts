import {
  Controller,
  Get,
  Post,
  Delete,
  Route,
  Body,
  Security,
  Request,
  Path,
  Tags,
} from "@tsoa/runtime";
import { ColonyService } from "../service/ColonyService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import type { ColonyData, ColonyResponse, ColonySummary } from "../model/types";

@Route("colony")
@Tags("Colony")
export class ColonyController extends Controller {
  /**
   * Saves or updates a colony state for the authenticated user.
   */
  @Security("jwt")
  @Post()
  public async saveColony(
    @Request() request: AuthenticatedRequest,
    @Body() body: ColonyData,
  ): Promise<{ id: number; message: string }> {
    const userId = request.user!.userId;
    const id = await ColonyService.saveColony(userId, body);
    return { id: Number(id), message: "Colony saved successfully" };
  }

  /**
   * Retrieves a specific colony by name for the authenticated user.
   */
  @Security("jwt")
  @Get("{name}")
  public async getColony(
    @Request() request: AuthenticatedRequest,
    @Path() name: string,
  ): Promise<ColonyResponse | { message: string }> {
    const userId = request.user!.userId;
    const colony = await ColonyService.getColony(userId, name);
    if (!colony) {
      this.setStatus(404);
      return { message: "Colony not found" };
    }
    return colony;
  }

  /**
   * Lists colonies of the authenticated user (id, name, dates; without state), newest `updatedAt` first.
   */
  @Security("jwt")
  @Get()
  public async listColonies(
    @Request() request: AuthenticatedRequest,
  ): Promise<ColonySummary[]> {
    const userId = request.user!.userId;
    return await ColonyService.listColonies(userId);
  }

  /**
   * Deletes a colony by name for the authenticated user.
   */
  @Security("jwt")
  @Delete("{name}")
  public async deleteColony(
    @Request() request: AuthenticatedRequest,
    @Path() name: string,
  ): Promise<{ message: string }> {
    const userId = request.user!.userId;
    await ColonyService.deleteColony(userId, name);
    return { message: "Colony deleted successfully" };
  }
}
