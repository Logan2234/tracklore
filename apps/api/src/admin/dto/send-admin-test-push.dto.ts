import { IsEmail } from "class-validator";
import type { SendAdminTestPushRequestDto } from "@tracklore/shared";

export class SendAdminTestPushDto implements SendAdminTestPushRequestDto {
  @IsEmail()
  email!: string;
}
