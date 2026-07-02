import { IsDateString, IsNumber, IsOptional, Max, Min } from "class-validator";

export class WatchEpisodeDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  watchedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;
}
