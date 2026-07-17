import { Module } from "@nestjs/common";
import { SecurityEventService } from "./security-event.service";

@Module({
  providers: [SecurityEventService],
  exports: [SecurityEventService],
})
export class SecurityModule {}
