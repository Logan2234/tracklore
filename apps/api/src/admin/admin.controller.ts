import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  ServiceStatusResponseDto,
} from "@tracklore/shared";
import { MailService } from "../mail/mail.service";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminService } from "./admin.service";
import { SendAdminTestPushDto } from "./dto/send-admin-test-push.dto";
import { SendTestEmailDto } from "./dto/send-test-email.dto";

@AdminOnly()
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  /** Health of every external dependency (config presence + live probe). */
  @Get("services")
  getServices(): Promise<ServiceStatusResponseDto> {
    return this.admin.getServicesStatus();
  }

  /** Every template available in the email gallery. */
  @Get("emails")
  listEmailTemplates(): MailTemplateListResponseDto {
    return {
      templates: this.mail.listTemplates(),
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  /** Renders one template with fixed sample data — nothing is sent. */
  @Get("emails/:key/preview")
  previewEmailTemplate(@Param("key") key: string): MailTemplatePreviewDto {
    const preview = this.mail.renderTemplatePreview(key);
    if (!preview) throw new NotFoundException("Unknown template");
    return preview;
  }

  /** Sends one template, rendered with the gallery's sample data, to a chosen address. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("emails/:key/test")
  async sendTestEmail(
    @Param("key") key: string,
    @Body() dto: SendTestEmailDto,
  ): Promise<void> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException("SMTP is not configured");
    }
    const sent = await this.mail.sendTemplateTest(key, dto.to);
    if (!sent) throw new NotFoundException("Unknown template");
  }

  /** Sends a sample push to every device of the account matching `email`. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("push/test")
  async sendAdminTestPush(@Body() dto: SendAdminTestPushDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("No account with this email");

    await this.push.sendToUser(user.id, {
      title: "Tracklore (admin)",
      body: "Ceci est une notification de test envoyée depuis le panel admin.",
      url: "/notifications",
    });
  }
}
