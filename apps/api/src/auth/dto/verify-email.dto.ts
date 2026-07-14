import { IsString } from "class-validator";
import type { VerifyEmailRequestDto } from "@tracklore/shared";

export class VerifyEmailDto implements VerifyEmailRequestDto {
  @IsString()
  token!: string;
}
