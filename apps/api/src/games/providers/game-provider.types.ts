import type { GameSource, GameSummaryDto } from "@tracklore/shared";

export interface ProviderGameExternalId {
  source: GameSource;
  externalId: string;
}

/** Everything a provider knows about one game, in canonical form. */
export interface ProviderGameDetails {
  summary: GameSummaryDto;
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: string | null;
  externalIds: ProviderGameExternalId[];
}

export interface GameCatalogProvider {
  readonly source: GameSource;
  search(query: string): Promise<GameSummaryDto[]>;
  getDetails(sourceId: string): Promise<ProviderGameDetails>;
}
