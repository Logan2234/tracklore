import { IsEmail } from "class-validator";
import type { ForgotPasswordRequestDto } from "@tracklore/shared";

export class ForgotPasswordDto implements ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;
}
