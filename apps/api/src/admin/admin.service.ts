import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ServiceArea,
  ServiceStatusDto,
  ServiceStatusResponseDto,
} from "@tracklore/shared";
import { MailService } from "../mail/mail.service";

/** Abort a probe after this delay so one dead service can't stall the page. */
const PROBE_TIMEOUT_MS = 5_000;

interface ServiceSpec {
  key: string;
  label: string;
  area: ServiceArea;
  required: boolean;
  /** Env var(s) that must all be set for the service to be configured. */
  envKeys: string[];
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
      };
    }

    let reachable: boolean | null = null;
    let detail: string | undefined;
    if (spec.probe) {
      try {
        reachable = await this.withTimeout(spec.probe);
        if (!reachable) detail = "Injoignable ou refusé";
      } catch {
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
