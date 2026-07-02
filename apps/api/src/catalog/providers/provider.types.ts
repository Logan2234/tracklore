import type {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@tracklore/shared";

export interface ProviderExternalId {
  source: MediaSource;
  externalId: string;
}

export interface ProviderEpisode {
  number: number;
  title: string | null;
  airDate: string | null;
}

export interface ProviderSeason {
  number: number;
  title: string | null;
  episodes: ProviderEpisode[];
}

/** Everything a provider knows about one media, in canonical form. */
export interface ProviderMediaDetails {
  summary: MediaSummaryDto;
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  status: string | null;
  releaseDate: string | null;
  externalIds: ProviderExternalId[];
  seasons: ProviderSeason[];
}

export interface CatalogProvider {
  readonly source: CatalogSource;
  search(query: string, type?: MediaType): Promise<MediaSummaryDto[]>;
  getDetails(sourceId: string, type: MediaType): Promise<ProviderMediaDetails>;
}
