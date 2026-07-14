import { IsDateString, IsOptional } from "class-validator";

export class AddGameReplayDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  finishedAt?: string;
}
