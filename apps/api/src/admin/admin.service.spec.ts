import type { ConfigService } from "@nestjs/config";
import type { MailService } from "../mail/mail.service";
import { AdminService } from "./admin.service";

function makeService(env: Record<string, string>, smtpReachable = true) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const mail = {
    verifyConnection: jest.fn().mockResolvedValue(smtpReachable),
  } as unknown as MailService;
  return { service: new AdminService(config, mail), mail };
}

describe("AdminService.getServicesStatus", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reports an unconfigured keyed service without probing it", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const { service } = makeService({}); // no keys set

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({
      configured: false,
      reachable: null,
      detail: "Clé absente",
    });
    // AniList is keyless, so it is still probed; but no keyed probe ran here.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("marks a configured service healthy on a 2xx probe", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ configured: true, reachable: true });
  });

  it("marks a configured service down on a non-2xx probe (rejected key)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "bad" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ configured: true, reachable: false });
  });

  it("treats a thrown probe (network error / timeout) as down", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("boom")) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb?.reachable).toBe(false);
  });

  it("probes SMTP via MailService.verifyConnection", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service, mail } = makeService(
      { SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" },
      false,
    );

    const { services } = await service.getServicesStatus();
    const smtp = services.find((s) => s.key === "smtp");

    expect(mail.verifyConnection).toHaveBeenCalled();
    expect(smtp).toMatchObject({ configured: true, reachable: false });
  });

  it("reports a configured-but-unprobed service (VAPID) as reachable:null", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
    });

    const { services } = await service.getServicesStatus();
    const push = services.find((s) => s.key === "webPush");

    expect(push).toMatchObject({ configured: true, reachable: null });
  });
});
