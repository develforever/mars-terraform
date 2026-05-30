import { Controller, Post, Route, Security, Tags } from "tsoa";
import { ColonyNameService } from "../service/ColonyNameService";

interface ColonyNamesResponse {
  names: string[];
}

@Route("colony-names")
@Tags("ColonyNames")
export class ColonyNameController extends Controller {
  /**
   * Generates creative Mars colony name suggestions using AI (OpenRouter).
   * Requires authentication. Falls back to local generator if AI is unavailable.
   */
  @Security("jwt")
  @Post("generate")
  public async generate(): Promise<ColonyNamesResponse> {
    const names = await ColonyNameService.generateNames(5);
    return { names };
  }
}
