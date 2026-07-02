import { IsEmail, IsString } from "class-validator";
import type { LoginRequestDto } from "@tracklore/shared";

export class LoginDto implements LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
