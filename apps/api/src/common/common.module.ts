import { Global, Module } from "@nestjs/common";
import { QuotaTrackerService } from "./quota-tracker.service";

@Global()
@Module({
  providers: [QuotaTrackerService],
  exports: [QuotaTrackerService],
})
export class CommonModule {}
