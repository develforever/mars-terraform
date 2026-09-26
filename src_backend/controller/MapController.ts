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
import { MapService } from "../service/MapService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import type { SaveMapDTO, MapSummaryResponse, MapDetailResponse } from "../model/mapTypes";

@Route("maps")
@Tags("Maps")
export class MapController extends Controller {
  /**
   * Saves or updates a map for the authenticated user.
   */
  @Security("jwt")
  @Post()
  public async saveMap(
    @Request() request: AuthenticatedRequest,
    @Body() body: SaveMapDTO,
  ): Promise<MapDetailResponse> {
    const userId = request.user!.userId;
    return await MapService.saveMap(userId, body);
  }

  /**
   * Lists all map summaries for the authenticated user.
   */
  @Security("jwt")
  @Get()
  public async listMaps(
    @Request() request: AuthenticatedRequest,
  ): Promise<MapSummaryResponse[]> {
    const userId = request.user!.userId;
    return await MapService.listMaps(userId);
  }

  /**
   * Retrieves a specific map by ID for the authenticated user.
   */
  @Security("jwt")
  @Get("{id}")
  public async getMap(
    @Request() request: AuthenticatedRequest,
    @Path() id: number,
  ): Promise<MapDetailResponse | { message: string }> {
    const userId = request.user!.userId;
    const map = await MapService.getMap(userId, id);
    if (!map) {
      this.setStatus(404);
      return { message: "Map not found" };
    }
    return map;
  }

  /**
   * Deletes a map by ID for the authenticated user.
   */
  @Security("jwt")
  @Delete("{id}")
  public async deleteMap(
    @Request() request: AuthenticatedRequest,
    @Path() id: number,
  ): Promise<{ message: string }> {
    const userId = request.user!.userId;
    const deleted = await MapService.deleteMap(userId, id);
    if (!deleted) {
      this.setStatus(404);
      return { message: "Map not found" };
    }
    return { message: "Map deleted successfully" };
  }
}
