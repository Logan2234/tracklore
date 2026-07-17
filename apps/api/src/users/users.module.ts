import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { AgeGateService } from "./age-gate.service";
import { DataExportService } from "./data-export.service";
import { DomainGateService } from "./domain-gate.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [MailModule, SecurityModule],
  controllers: [UsersController],
  providers: [AgeGateService, DomainGateService, DataExportService],
  exports: [AgeGateService, DomainGateService, DataExportService],
})
export class UsersModule {}
