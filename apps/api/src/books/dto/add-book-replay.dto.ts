import { IsDateString, IsOptional } from "class-validator";

export class AddBookReplayDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  finishedAt?: string;
}
