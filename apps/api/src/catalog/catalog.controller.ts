import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import {
  CastDetailDto,
  CatalogSource,
  MediaDetailsDto,
  MediaExtrasDto,
  MediaType,
  SearchResponseDto,
} from "@tracklore/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { MediaItemService } from "./media-item.service";
import { rankBySearchRelevance } from "./search-ranking";
import { SearchQueryDto } from "./dto/search-query.dto";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
  ) {}

  /**
   * Live search. ANIME goes to AniList, MOVIE/SERIES to TMDB; without a type
   * filter both sources are queried and merged. 18+ titles are stripped
   * unless the account opted in and is confirmed 18+.
   */
  @Get("search")
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    const wantTmdb = query.type === undefined || query.type !== MediaType.ANIME;
    const wantAnilist =
      query.type === undefined || query.type === MediaType.ANIME;
    const page = query.page ?? 1;

    const [tmdbResults, anilistResults, allowAdult] = await Promise.all([
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
      this.ageGate.allowsAdultContent(user.sub),
    ]);

    // Each source returns its own popularity order, but concatenating movies +
    // series + anime buries the searched title. Re-rank by title relevance so
    // the actual match floats to the top (ties keep the source order).
    return {
      results: filterAdultContent(
        rankBySearchRelevance([...anilistResults, ...tmdbResults], query.q),
        allowAdult,
      ),
    };
  }

  /** Live detail of a cast entity (TMDB person) for the media-page modal. */
  @Get(":source/person/:id")
  async getPerson(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
  ): Promise<CastDetailDto> {
    const source = parseSource(sourceParam);
    const provider = this.mediaItemService.providerFor(source);

    if (!provider.getPerson) {
      throw new BadRequestException(`${source} has no person details`);
    }

    const detail = await provider.getPerson(id);
    const allowAdult = await this.ageGate.allowsAdultContent(user.sub);
    return {
      ...detail,
      knownFor: filterAdultContent(detail.knownFor, allowAdult),
    };
  }

  /** Live details (seasons/episodes included) — nothing is persisted. */
  @Get(":source/:id")
  async getDetails(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("type") type?: MediaType,
  ): Promise<MediaDetailsDto> {
    const source = parseSource(sourceParam);
    const resolvedType = resolveType(source, type);
    const details = await this.mediaItemService.getLiveDetails(
      source,
      id,
      resolvedType,
    );

    if (details.isAdult && !(await this.ageGate.allowsAdultContent(user.sub))) {
      throw new ForbiddenException(
        "This title is restricted to accounts with adult content enabled",
      );
    }

    return details;
  }

  /** Live extras (where to watch, cast, similar) — nothing is persisted. */
  @Get(":source/:id/extras")
  async getExtras(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("type") type?: MediaType,
  ): Promise<MediaExtrasDto> {
    const source = parseSource(sourceParam);
    const resolvedType = resolveType(source, type);
    const extras = await this.mediaItemService
      .providerFor(source)
      .getExtras(id, resolvedType);
    const allowAdult = await this.ageGate.allowsAdultContent(user.sub);
    return {
      ...extras,
      similar: filterAdultContent(extras.similar, allowAdult),
    };
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
