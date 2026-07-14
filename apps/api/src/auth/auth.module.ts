import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MailModule } from "../mail/mail.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionsController } from "./sessions.controller";

@Module({
  // Secrets are provided per sign/verify call (access vs refresh), so no default here.
  imports: [JwtModule.register({ global: true }), MailModule],
  controllers: [AuthController, SessionsController],
  providers: [AuthService],
})
export class AuthModule {}
