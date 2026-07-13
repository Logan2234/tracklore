import { Module } from "@nestjs/common";
import { AgeGateService } from "./age-gate.service";
import { DomainGateService } from "./domain-gate.service";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [AgeGateService, DomainGateService],
  exports: [AgeGateService, DomainGateService],
})
export class UsersModule {}
