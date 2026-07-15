import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import type { SendAdminTestPushRequestDto } from "@tracklore/shared";

export class SendAdminTestPushDto implements SendAdminTestPushRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
