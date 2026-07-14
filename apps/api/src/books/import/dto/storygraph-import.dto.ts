import {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  StoryGraphImportCommitBookDto,
  StoryGraphImportCommitRequestDto,
  StoryGraphImportPreviewRequestDto,
} from "@tracklore/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class StoryGraphPreviewDto implements StoryGraphImportPreviewRequestDto {
  @IsString()
  @MinLength(1)
  // A StoryGraph export stays well under a megabyte; cap it defensively.
  @MaxLength(5_000_000)
  csv!: string;
}

class StoryGraphCommitBookDto implements StoryGraphImportCommitBookDto {
  @IsIn(Object.values(BookSource))
  source!: BookSource;

  @IsString()
  sourceId!: string;

  @IsIn(Object.values(BookStatus))
  status!: BookStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes!: string | null;

  @IsOptional()
  @IsISO8601()
  startedAt!: string | null;

  @IsOptional()
  @IsISO8601()
  finishedAt!: string | null;

  @IsIn(Object.values(BookOwnershipStatus))
  ownershipStatus!: BookOwnershipStatus;

  @IsInt()
  @Min(0)
  @Max(10_000)
  readCount!: number;
}

export class StoryGraphCommitDto implements StoryGraphImportCommitRequestDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StoryGraphCommitBookDto)
  books!: StoryGraphCommitBookDto[];
}
