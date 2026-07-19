import { Injectable } from "@nestjs/common";
import { Domain } from "@tracklore/shared";
import { toCsv } from "../common/csv.util";
import { PrismaService } from "../prisma/prisma.service";

const isoDate = (d: Date | null): string => d?.toISOString().slice(0, 10) ?? "";

/**
 * Flat, per-domain CSV export for migrating to another tool (Storygraph,
 * a spreadsheet…) — unlike `DataExportService`'s nested GDPR dump, this is one
 * row per library entry and deliberately ignores `User.enabledDomains`: a
 * domain the user hid from their own nav is still theirs to export.
 */
@Injectable()
export class CsvExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCsv(userId: string, domain: Domain): Promise<string> {
    switch (domain) {
      case Domain.MEDIA:
        return this.buildMediaCsv(userId);
      case Domain.GAMES:
        return this.buildGamesCsv(userId);
      case Domain.BOOKS:
        return this.buildBooksCsv(userId);
      case Domain.MUSIC:
        return this.buildMusicCsv(userId);
    }
  }

  private async buildMediaCsv(userId: string): Promise<string> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      include: { mediaItem: true },
      orderBy: { createdAt: "asc" },
    });

    return toCsv([
      [
        "Title",
        "Type",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Genres",
      ],
      ...entries.map((e) => [
        e.mediaItem.title,
        e.mediaItem.type,
        e.status,
        e.rating,
        e.notes,
        e.favorite ? "true" : "false",
        isoDate(e.startedAt),
        isoDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        isoDate(e.mediaItem.releaseDate),
        e.mediaItem.genres.join("; "),
      ]),
    ]);
  }

  private async buildGamesCsv(userId: string): Promise<string> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      include: { gameItem: true, replays: true },
      orderBy: { createdAt: "asc" },
    });

    return toCsv([
      [
        "Title",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Playtime Minutes",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Genres",
        "Platforms",
        "Replays",
      ],
      ...entries.map((e) => [
        e.gameItem.title,
        e.status,
        e.rating,
        e.notes,
        e.favorite ? "true" : "false",
        e.playtimeMinutes,
        isoDate(e.startedAt),
        isoDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        isoDate(e.gameItem.releaseDate),
        e.gameItem.genres.join("; "),
        e.gameItem.platforms.join("; "),
        e.replays.length,
      ]),
    ]);
  }

  private async buildBooksCsv(userId: string): Promise<string> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      include: { bookItem: true, replays: true },
      orderBy: { createdAt: "asc" },
    });

    return toCsv([
      [
        "Title",
        "Authors",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Current Page",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Page Count",
        "Genres",
        "Replays",
      ],
      ...entries.map((e) => [
        e.bookItem.title,
        e.bookItem.authors.join("; "),
        e.status,
        e.rating,
        e.notes,
        e.favorite ? "true" : "false",
        e.currentPage,
        isoDate(e.startedAt),
        isoDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        isoDate(e.bookItem.releaseDate),
        e.bookItem.pageCount,
        e.bookItem.genres.join("; "),
        e.replays.length,
      ]),
    ]);
  }

  private async buildMusicCsv(userId: string): Promise<string> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      include: { musicItem: true },
      orderBy: { createdAt: "asc" },
    });

    return toCsv([
      [
        "Title",
        "Artists",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Genres",
      ],
      ...entries.map((e) => [
        e.musicItem.title,
        e.musicItem.artists.join("; "),
        e.status,
        e.rating,
        e.notes,
        e.favorite ? "true" : "false",
        isoDate(e.startedAt),
        isoDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        isoDate(e.musicItem.releaseDate),
        e.musicItem.genres.join("; "),
      ]),
    ]);
  }
}
