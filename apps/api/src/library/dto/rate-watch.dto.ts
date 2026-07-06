import { IsNumber, Max, Min, ValidateIf } from "class-validator";

export class RateWatchDto {
  /** 0–10 (half-points allowed), or null to clear the rating. */
  @ValidateIf((o) => o.rating !== null)
  @IsNumber()
  @Min(0)
  @Max(10)
  rating!: number | null;
}
