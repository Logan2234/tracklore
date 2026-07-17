import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AdminBackupDto } from "@tracklore/shared";
import { spawn } from "node:child_process";

/**
 * Shells out to the Postgres client tools (pg_dump/psql) rather than
 * reimplementing a dump in Prisma: it's the only way to get a complete,
 * faithfully-restorable snapshot (every table, type, constraint) without
 * hand-maintaining an exporter that tracks every future migration. Plain-SQL
 * format (not pg_dump's custom binary format) so the dump travels as a normal
 * string through the same JSON request/response + Blob-download pattern the
 * rest of the app already uses (see ExportSection.svelte) — no multipart
 * upload needed.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  async dump(): Promise<AdminBackupDto> {
    const sql = await this.run("pg_dump", [
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
    ]);

    return {
      sql,
      generatedAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength(sql, "utf-8"),
    };
  }

  /**
   * Replaces the entire database with `sql` (a dump produced by {@link dump}),
   * then re-applies any migration shipped since that dump was taken — the
   * dump's own `_prisma_migrations` table only reflects schema state as of
   * that snapshot, so a restore from an older backup would otherwise leave
   * the running app's Prisma client out of sync with the just-restored schema.
   */
  async restore(sql: string): Promise<void> {
    await this.run("psql", ["--set", "ON_ERROR_STOP=1"], sql);
    await this.run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  }

  /** Connection info for pg_dump/psql via the standard libpq PG* env vars — keeps the password out of argv/`ps`. */
  private pgEnv(): NodeJS.ProcessEnv {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new ServiceUnavailableException("DATABASE_URL is not set");
    }

    const url = new URL(databaseUrl);
    return {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.replace(/^\//, ""),
    };
  }

  private run(
    command: string,
    args: string[],
    stdin?: string,
  ): Promise<string> {
    const env = command === "pnpm" ? process.env : this.pgEnv();

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new ServiceUnavailableException(
              `${command} is not installed on this instance`,
            ),
          );
        } else {
          reject(new InternalServerErrorException(err.message));
        }
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          this.logger.error(`${command} exited with code ${code}: ${stderr}`);
          reject(
            new InternalServerErrorException(
              stderr.trim() || `${command} failed (exit ${code})`,
            ),
          );
        }
      });

      if (stdin !== undefined) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}
