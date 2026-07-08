import { Module } from "@nestjs/common";
import { AgeGateService } from "./age-gate.service";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [AgeGateService],
  exports: [AgeGateService],
})
export class UsersModule {}
