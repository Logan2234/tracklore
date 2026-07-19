import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import type {
  AdminCacheItemDto,
  AdminCacheListResponseDto,
} from "@tracklore/shared";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { GameItemService } from "../games/game-item.service";
import { MusicItemService } from "../music/music-item.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";

const PAGE_SIZE = 50;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const DOMAINS = ["MEDIA", "GAMES", "BOOKS", "MUSIC"] as const;
type CacheDomain = (typeof DOMAINS)[number];

/** Browse the on-demand catalogue cache and trigger a manual re-sync per item. */
@AdminOnly()
@Controller("admin")
export class AdminCacheController {
  private readonly logger = new Logger(AdminCacheController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItems: MediaItemService,
    private readonly gameItems: GameItemService,
    private readonly bookItems: BookItemService,
    private readonly musicItems: MusicItemService,
  ) {}

  /** Cached items for one domain, most recently synced last (stale first). */
  @Get("cache")
  async list(
    @Query("domain") domain: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
  ): Promise<AdminCacheListResponseDto> {
    const cacheDomain = this.domainOrThrow(domain);
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const skip = (pageNum - 1) * PAGE_SIZE;
    const query = search?.trim();

    switch (cacheDomain) {
      case "MEDIA": {
        const where = query
          ? { title: { contains: query, mode: "insensitive" as const } }
          : {};
        const [rows, total] = await Promise.all([
          this.prisma.mediaItem.findMany({
            where,
            orderBy: { lastSyncedAt: "asc" },
            skip,
            take: PAGE_SIZE,
            include: { _count: { select: { entries: true } } },
          }),
          this.prisma.mediaItem.count({ where }),
        ]);
        return {
          total,
          items: rows.map((r) =>
            this.toDto(
              "MEDIA",
              r.id,
              r.title,
              r.posterUrl,
              r.canonicalSource,
              r.lastSyncedAt,
              r.createdAt,
              r._count.entries,
            ),
          ),
        };
      }

      case "GAMES": {
        const where = query
          ? { title: { contains: query, mode: "insensitive" as const } }
          : {};
        const [rows, total] = await Promise.all([
          this.prisma.gameItem.findMany({
            where,
            orderBy: { lastSyncedAt: "asc" },
            skip,
            take: PAGE_SIZE,
            include: { _count: { select: { entries: true } } },
          }),
          this.prisma.gameItem.count({ where }),
        ]);
        return {
          total,
          items: rows.map((r) =>
            this.toDto(
              "GAMES",
              r.id,
              r.title,
              r.coverUrl,
              r.canonicalSource,
              r.lastSyncedAt,
              r.createdAt,
              r._count.entries,
            ),
          ),
        };
      }

      case "BOOKS": {
        const where = query
          ? { title: { contains: query, mode: "insensitive" as const } }
          : {};
        const [rows, total] = await Promise.all([
          this.prisma.bookItem.findMany({
            where,
            orderBy: { lastSyncedAt: "asc" },
            skip,
            take: PAGE_SIZE,
            include: { _count: { select: { entries: true } } },
          }),
          this.prisma.bookItem.count({ where }),
        ]);
        return {
          total,
          items: rows.map((r) =>
            this.toDto(
              "BOOKS",
              r.id,
              r.title,
              r.coverUrl,
              r.canonicalSource,
              r.lastSyncedAt,
              r.createdAt,
              r._count.entries,
            ),
          ),
        };
      }

      case "MUSIC": {
        const where = query
          ? { title: { contains: query, mode: "insensitive" as const } }
          : {};
        const [rows, total] = await Promise.all([
          this.prisma.musicItem.findMany({
            where,
            orderBy: { lastSyncedAt: "asc" },
            skip,
            take: PAGE_SIZE,
            include: { _count: { select: { entries: true } } },
          }),
          this.prisma.musicItem.count({ where }),
        ]);
        return {
          total,
          items: rows.map((r) =>
            this.toDto(
              "MUSIC",
              r.id,
              r.title,
              r.coverUrl,
              r.canonicalSource,
              r.lastSyncedAt,
              r.createdAt,
              r._count.entries,
            ),
          ),
        };
      }
    }
  }

  /** Forces a re-sync from the canonical source, bypassing the 24h TTL. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("cache/:domain/:id/resync")
  async resync(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<void> {
    const cacheDomain = this.domainOrThrow(domain);

    try {
      switch (cacheDomain) {
        case "MEDIA":
          await this.mediaItems.forceRefresh(id);
          return;
        case "GAMES":
          await this.gameItems.forceRefresh(id);
          return;
        case "BOOKS":
          await this.bookItems.forceRefresh(id);
          return;
        case "MUSIC":
          await this.musicItems.forceRefresh(id);
          return;
      }
    } catch (err) {
      this.logger.error(`Resync failed for ${cacheDomain}/${id}`, err);
      throw new NotFoundException("Item introuvable ou source injoignable");
    }
  }

  private domainOrThrow(domain: string): CacheDomain {
    if (!DOMAINS.includes(domain as CacheDomain)) {
      throw new BadRequestException(`Unknown cache domain: ${domain}`);
    }

    return domain as CacheDomain;
  }

  private toDto(
    domain: CacheDomain,
    id: string,
    title: string,
    coverUrl: string | null,
    canonicalSource: string,
    lastSyncedAt: Date,
    createdAt: Date,
    referenceCount: number,
  ): AdminCacheItemDto {
    return {
      id,
      domain,
      title,
      coverUrl,
      canonicalSource,
      lastSyncedAt: lastSyncedAt.toISOString(),
      createdAt: createdAt.toISOString(),
      referenceCount,
      stale: Date.now() - lastSyncedAt.getTime() >= STALE_TTL_MS,
    };
  }
}
