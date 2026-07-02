import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { AuthTokensDto } from "@tracklore/shared";
import { AuthResult, AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto): Promise<{ tokens: AuthTokensDto }> {
    return { tokens: await this.authService.refresh(dto.refreshToken) };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
