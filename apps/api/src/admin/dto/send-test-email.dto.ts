import { IsEmail } from "class-validator";
import type { SendTestEmailRequestDto } from "@tracklore/shared";

export class SendTestEmailDto implements SendTestEmailRequestDto {
  @IsEmail()
  to!: string;
}
