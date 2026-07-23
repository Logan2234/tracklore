import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateReportBody {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
