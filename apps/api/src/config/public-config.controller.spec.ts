import type { ConfigService } from "@nestjs/config";
import { PublicConfigController } from "./public-config.controller";

function makeController(socialEnabledValue: string | undefined) {
  const config = {
    get: jest.fn().mockReturnValue(socialEnabledValue),
  } as unknown as ConfigService;

  return { controller: new PublicConfigController(config), config };
}

describe("PublicConfigController", () => {
  it('reports socialEnabled=true only when SOCIAL_ENABLED is exactly "true"', () => {
    const { controller } = makeController("true");
    expect(controller.get()).toEqual({ socialEnabled: true });
  });

  it("reports socialEnabled=false when the flag is unset", () => {
    const { controller } = makeController(undefined);
    expect(controller.get()).toEqual({ socialEnabled: false });
  });

  it('treats any non-"true" value as disabled', () => {
    const { controller } = makeController("1");
    expect(controller.get()).toEqual({ socialEnabled: false });
  });
});
