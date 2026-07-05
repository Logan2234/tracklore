import type { StartTvTimeImportDto } from "@tracklore/shared";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class StartImportDto implements StartTvTimeImportDto {
  /** The TV Time GDPR export `.zip`, base64-encoded. */
  @IsString()
  @IsNotEmpty()
  zipBase64!: string;

  @IsOptional()
  @IsBoolean()
  importMovies?: boolean;
}
