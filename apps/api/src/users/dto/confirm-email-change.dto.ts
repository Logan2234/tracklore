import { IsString, Length } from "class-validator";
import type { ConfirmEmailChangeRequestDto } from "@tracklore/shared";

export class ConfirmEmailChangeDto implements ConfirmEmailChangeRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
