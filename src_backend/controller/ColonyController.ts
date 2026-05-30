import {
  Controller,
  Get,
  Post,
  Route,
  Body,
  Security,
  Request,
  Path,
  Tags,
} from "tsoa";
import { ColonyData, ColonyService } from "../service/ColonyService";

interface AuthenticatedRequest extends Express.Request {
  user: {
    userId: number;
    email: string;
  };
}

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
    @Body() body: ColonyData
  ): Promise<{ id: number; message: string }> {
    const userId = request.user.userId;
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
    @Path() name: string
  ): Promise<any> {
    const userId = request.user.userId;
    const colony = await ColonyService.getColony(userId, name);
    if (!colony) {
      this.setStatus(404);
      return { message: "Colony not found" };
    }
    return colony;
  }

  /**
   * Lists all colonies for the authenticated user.
   */
  @Security("jwt")
  @Get()
  public async listColonies(
    @Request() request: AuthenticatedRequest
  ): Promise<any[]> {
    const userId = request.user.userId;
    return await ColonyService.listColonies(userId);
  }
}
