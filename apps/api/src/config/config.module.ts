import { Module } from "@nestjs/common";
import { PublicConfigController } from "./public-config.controller";

// Exposes the deployment's public runtime flags (see PublicConfigDto). Named
// RuntimeConfigModule to avoid confusion with @nestjs/config's ConfigModule.
@Module({
  controllers: [PublicConfigController],
})
export class RuntimeConfigModule {}
