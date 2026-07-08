import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

// PrismaService comes from the global PrismaModule.
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
