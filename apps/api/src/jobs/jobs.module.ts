import { Module } from "@nestjs/common";
import { JobRunService } from "./job-run.service";

// PrismaService comes from the global PrismaModule.
@Module({
  providers: [JobRunService],
  exports: [JobRunService],
})
export class JobsModule {}
