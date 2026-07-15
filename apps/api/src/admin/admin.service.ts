import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SchemaGraphResponseDto,
  ServiceArea,
  ServiceStatusDto,
  ServiceStatusResponseDto,
} from "@tracklore/shared";
import { MailService } from "../mail/mail.service";

// docs/ is gitignored and regenerated locally (`prisma generate` for the ERD,
// `pnpm --filter @tracklore/api run graph` for the module graph). process.cwd()
// is apps/api in both dev (pnpm --filter) and the Docker image (WORKDIR).
const DOCS_DIR = join(process.cwd(), "..", "..", "docs");

/** Strips the ```mermaid fence a generated doc wraps its diagram in. */
function extractMermaid(markdown: string): string {
  return markdown
    .replace(/^```mermaid\n/, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Abort a probe after this delay so one dead service can't stall the page. */
const PROBE_TIMEOUT_MS = 5_000;

interface ServiceSpec {
  key: string;
  label: string;
  area: ServiceArea;
  required: boolean;
  /** Env var(s) that must all be set for the service to be configured. */
  envKeys: string[];
  /** Where to obtain the missing key/credentials, shown when unconfigured. */
  keyUrl?: string;
  /**
   * Live probe. Resolves to `true`/`false` when it ran, or `null` when there's
   * nothing cheap to ping (only the config presence is reported). Receives the
   * abort signal so the request is bounded by {@link PROBE_TIMEOUT_MS}.
   */
  probe?: (signal: AbortSignal) => Promise<boolean>;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private get specs(): ServiceSpec[] {
    return [
      {
        key: "tmdb",
        label: "TMDB",
        area: "Écrans",
        required: true,
        envKeys: ["TMDB_API_TOKEN"],
        keyUrl: "https://www.themoviedb.org/settings/api",
        probe: (signal) =>
          this.ping("https://api.themoviedb.org/3/configuration", {
            signal,
            headers: {
              Authorization: `Bearer ${this.env("TMDB_API_TOKEN")}`,
            },
          }),
      },
      {
        // Keyless fallback: search still works for anime without any credentials.
        key: "anilist",
        label: "AniList",
        area: "Écrans",
        required: false,
        envKeys: [],
        probe: (signal) =>
          this.ping("https://graphql.anilist.co", {
            signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{__typename}" }),
          }),
      },
      {
        key: "omdb",
        label: "OMDb (notes)",
        area: "Écrans",
        required: false,
        envKeys: ["OMDB_API_KEY"],
        keyUrl: "https://www.omdbapi.com/apikey.aspx",
        probe: (signal) =>
          this.ping(
            `https://www.omdbapi.com/?apikey=${this.env("OMDB_API_KEY")}&i=tt0111161`,
            { signal },
          ),
      },
      {
        key: "igdb",
        label: "IGDB (Twitch)",
        area: "Jeux",
        required: true,
        envKeys: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
        keyUrl: "https://dev.twitch.tv/console/apps",
        // Exchanging the client credentials validates both the reachability of
        // Twitch's OAuth endpoint and that the secret pair is accepted.
        probe: (signal) =>
          this.ping(
            "https://id.twitch.tv/oauth2/token" +
              `?client_id=${this.env("TWITCH_CLIENT_ID")}` +
              `&client_secret=${this.env("TWITCH_CLIENT_SECRET")}` +
              "&grant_type=client_credentials",
            { signal, method: "POST" },
          ),
      },
      {
        key: "steam",
        label: "Steam",
        area: "Jeux",
        required: false,
        envKeys: ["STEAM_API_KEY"],
        keyUrl: "https://steamcommunity.com/dev/apikey",
        // Keyless health endpoint: reports Steam reachability independent of the
        // key (the key only gates the actual import).
        probe: (signal) =>
          this.ping(
            "https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/",
            { signal },
          ),
      },
      {
        key: "googleBooks",
        label: "Google Books",
        area: "Livres",
        required: true,
        envKeys: ["GOOGLE_BOOKS_API_KEY"],
        keyUrl:
          "https://console.cloud.google.com/apis/library/books.googleapis.com",
        probe: (signal) =>
          this.ping(
            "https://www.googleapis.com/books/v1/volumes?q=isbn:9780262033848" +
              `&key=${this.env("GOOGLE_BOOKS_API_KEY")}`,
            { signal },
          ),
      },
      {
        key: "smtp",
        label: "SMTP (email)",
        area: "Système",
        required: false,
        envKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
        keyUrl: "https://www.brevo.com",
        probe: () => this.mail.verifyConnection(),
      },
      {
        // No external to ping: presence of the VAPID key pair is the signal.
        key: "webPush",
        label: "Web Push (VAPID)",
        area: "Système",
        required: false,
        envKeys: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      },
    ];
  }

  /** Reads the two locally-generated architecture diagrams, `null` when absent. */
  async getSchemaGraphs(): Promise<SchemaGraphResponseDto> {
    const [erd, modules] = await Promise.all([
      this.readGraph("erd.md"),
      this.readGraph("modules.md"),
    ]);
    return { erd, modules };
  }

  private async readGraph(filename: string): Promise<string | null> {
    try {
      const raw = await readFile(join(DOCS_DIR, filename), "utf-8");
      return extractMermaid(raw);
    } catch {
      return null;
    }
  }

  async getServicesStatus(): Promise<ServiceStatusResponseDto> {
    const services = await Promise.all(
      this.specs.map((spec) => this.evaluate(spec)),
    );
    return { services, checkedAt: new Date().toISOString() };
  }

  private async evaluate(spec: ServiceSpec): Promise<ServiceStatusDto> {
    const configured = spec.envKeys.every((k) => Boolean(this.env(k)));

    // Don't probe a service we know isn't configured — a required key/secret is
    // missing, so a live call would only ever confirm the obvious failure.
    if (!configured && spec.envKeys.length > 0) {
      return {
        key: spec.key,
        label: spec.label,
        area: spec.area,
        required: spec.required,
        configured: false,
        reachable: null,
        detail: "Clé absente",
        keyUrl: spec.keyUrl,
      };
    }

    let reachable: boolean | null = null;
    let detail: string | undefined;
    let latencyMs: number | undefined;

    if (spec.probe) {
      const start = Date.now();

      try {
        reachable = await this.withTimeout(spec.probe);
        latencyMs = Date.now() - start;
        if (!reachable) detail = "Injoignable ou refusé";
      } catch {
        latencyMs = Date.now() - start;
        reachable = false;
        detail = "Injoignable ou refusé";
      }
    }

    return {
      key: spec.key,
      label: spec.label,
      area: spec.area,
      required: spec.required,
      configured,
      reachable,
      detail,
      latencyMs,
    };
  }

  private env(key: string): string {
    return this.config.get<string>(key) ?? "";
  }

  /** Runs a probe under an abort-timeout, so no single service stalls the page. */
  private async withTimeout(
    probe: (signal: AbortSignal) => Promise<boolean>,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      return await probe(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * A health ping: only a 2xx response counts as healthy, so a rejected key
   * (401/403) or bad credentials (400) surface as "down" rather than merely
   * "the host answered". OMDb is a known exception — it replies 200 even for an
   * invalid key — but presence of the key is already reported separately.
   */
  private async ping(url: string, init: RequestInit): Promise<boolean> {
    const response = await fetch(url, init);
    return response.ok;
  }
}
