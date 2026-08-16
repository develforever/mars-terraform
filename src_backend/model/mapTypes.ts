export interface SaveMapDTO {
  id?: number;
  name: string;
  description?: string;
  players?: number;
  version?: string;
  data: string;
}

export interface MapSummaryResponse {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  players: number;
  version: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MapDetailResponse extends MapSummaryResponse {
  data: string;
}
