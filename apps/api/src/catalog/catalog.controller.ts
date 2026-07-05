import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import {
  CatalogSource,
  MediaDetailsDto,
  MediaType,
  SearchResponseDto,
} from "@tracklore/shared";
import { MediaItemService } from "./media-item.service";
import { rankBySearchRelevance } from "./search-ranking";
import { SearchQueryDto } from "./dto/search-query.dto";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly mediaItemService: MediaItemService) {}

  /**
   * Live search. ANIME goes to AniList, MOVIE/SERIES to TMDB; without a type
   * filter both sources are queried and merged.
   */
  @Get("search")
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    const wantTmdb = query.type === undefined || query.type !== MediaType.ANIME;
    const wantAnilist =
      query.type === undefined || query.type === MediaType.ANIME;
    const page = query.page ?? 1;

    const [tmdbResults, anilistResults] = await Promise.all([
      wantTmdb
        ? this.mediaItemService
            .providerFor(CatalogSource.TMDB)
            .search(query.q, query.type, page)
        : Promise.resolve([]),
      wantAnilist
        ? this.mediaItemService
            .providerFor(CatalogSource.ANILIST)
            .search(query.q, undefined, page)
        : Promise.resolve([]),
    ]);

    // Each source returns its own popularity order, but concatenating movies +
    // series + anime buries the searched title. Re-rank by title relevance so
    // the actual match floats to the top (ties keep the source order).
    return {
      results: rankBySearchRelevance(
        [...anilistResults, ...tmdbResults],
        query.q,
      ),
    };
  }

  /** Live details (seasons/episodes included) — nothing is persisted. */
  @Get(":source/:id")
  getDetails(
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("type") type?: MediaType,
  ): Promise<MediaDetailsDto> {
    const source = parseSource(sourceParam);
    const resolvedType = resolveType(source, type);
    return this.mediaItemService.getLiveDetails(source, id, resolvedType);
  }
}

function parseSource(value: string): CatalogSource {
  const upper = value.toUpperCase();
  if (upper !== CatalogSource.TMDB && upper !== CatalogSource.ANILIST) {
    throw new BadRequestException(`Unknown catalog source '${value}'`);
  }
  return upper;
}

/** AniList only serves anime; TMDB needs the caller to disambiguate movie vs series. */
export function resolveType(
  source: CatalogSource,
  type?: MediaType,
): MediaType {
  if (source === CatalogSource.ANILIST) {
    return MediaType.ANIME;
  }
  if (type !== MediaType.MOVIE && type !== MediaType.SERIES) {
    throw new BadRequestException(
      "TMDB media require 'type' to be MOVIE or SERIES",
    );
  }
  return type;
}
