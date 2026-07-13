import {
  GameStatus,
  SteamImportCommitGameDto,
  SteamImportCommitRequestDto,
  SteamImportPreviewRequestDto,
} from "@tracklore/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class SteamPreviewDto implements SteamImportPreviewRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  steamId!: string;
}

class SteamCommitGameDto implements SteamImportCommitGameDto {
  @IsString()
  sourceId!: string;

  @IsIn(Object.values(GameStatus))
  status!: GameStatus;

  @IsInt()
  @Min(0)
  playtimeMinutes!: number;
}

export class SteamCommitDto implements SteamImportCommitRequestDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SteamCommitGameDto)
  games!: SteamCommitGameDto[];
}
