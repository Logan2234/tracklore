import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { AgeGateService } from "./age-gate.service";
import { DomainGateService } from "./domain-gate.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [AgeGateService, DomainGateService],
  exports: [AgeGateService, DomainGateService],
})
export class UsersModule {}
