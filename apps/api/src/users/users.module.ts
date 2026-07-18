import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { AgeGateService } from "./age-gate.service";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { DomainGateService } from "./domain-gate.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [MailModule, SecurityModule],
  controllers: [UsersController],
  providers: [AgeGateService, DomainGateService, DataExportService, CsvExportService],
  exports: [AgeGateService, DomainGateService, DataExportService, CsvExportService],
})
export class UsersModule {}
