import {
  type ReviewVisibility,
  ReviewVisibility as ReviewVisibilityEnum,
} from "@tracklore/shared";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpsertReviewBody {
  // Mandatory /10 rating, half-point steps enforced client-side.
  @IsNumber()
  @Min(0)
  @Max(10)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string | null;

  @IsOptional()
  @IsIn(Object.values(ReviewVisibilityEnum))
  visibility?: ReviewVisibility;
}
