import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  // Secrets are provided per sign/verify call (access vs refresh), so no default here.
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
