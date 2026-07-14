import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  /** Public web app origin, for links inside emails (reset, verify…). */
  private readonly webOrigin: string;

  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
      process.env;
    this.webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
    this.from = SMTP_FROM ?? "Tracklore <no-reply@tracklore.app>";

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const port = Number(SMTP_PORT ?? 587);
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    } else {
      // Self-host without SMTP configured: mail is a no-op, the rest of the
      // app still works (mirrors PushService's VAPID-less fallback).
      this.transporter = null;
      this.logger.warn("SMTP not configured — outgoing email is disabled");
    }
  }

  async sendPasswordResetLink(to: string, token: string): Promise<void> {
    const url = `${this.webOrigin}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: "Réinitialise ton mot de passe Tracklore",
      text: `Un lien de réinitialisation a été demandé pour ton compte Tracklore.\n\n${url}\n\nCe lien expire dans 1h. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
      html: `<p>Un lien de réinitialisation a été demandé pour ton compte Tracklore.</p><p><a href="${url}">${url}</a></p><p>Ce lien expire dans 1h. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
    });
  }

  async sendPasswordChanged(to: string): Promise<void> {
    await this.send({
      to,
      subject: "Ton mot de passe Tracklore a été modifié",
      text: "Le mot de passe de ton compte Tracklore vient d'être changé. Si tu n'es pas à l'origine de cette action, contacte-nous immédiatement.",
      html: "<p>Le mot de passe de ton compte Tracklore vient d'être changé. Si tu n'es pas à l'origine de cette action, contacte-nous immédiatement.</p>",
    });
  }

  async sendEmailChanged(oldEmail: string, newEmail: string): Promise<void> {
    await Promise.all([
      this.send({
        to: oldEmail,
        subject: "L'email de ton compte Tracklore a changé",
        text: `L'adresse email de ton compte Tracklore a été changée pour ${newEmail}. Si tu n'es pas à l'origine de cette action, contacte-nous immédiatement.`,
        html: `<p>L'adresse email de ton compte Tracklore a été changée pour <strong>${newEmail}</strong>. Si tu n'es pas à l'origine de cette action, contacte-nous immédiatement.</p>`,
      }),
      this.send({
        to: newEmail,
        subject: "Cette adresse est maintenant liée à ton compte Tracklore",
        text: `Cette adresse est désormais l'email de connexion de ton compte Tracklore (précédemment ${oldEmail}).`,
        html: `<p>Cette adresse est désormais l'email de connexion de ton compte Tracklore (précédemment ${oldEmail}).</p>`,
      }),
    ]);
  }

  async sendWelcome(to: string, displayName: string): Promise<void> {
    await this.send({
      to,
      subject: "Bienvenue sur Tracklore",
      text: `Bienvenue ${displayName} ! Ton compte Tracklore a été créé avec succès.`,
      html: `<p>Bienvenue ${displayName} ! Ton compte Tracklore a été créé avec succès.</p>`,
    });
  }

  async sendVerifyEmail(to: string, token: string): Promise<void> {
    const url = `${this.webOrigin}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: "Confirme ton adresse email Tracklore",
      text: `Confirme ton adresse email en ouvrant ce lien :\n\n${url}\n\nCe lien expire dans 24h.`,
      html: `<p>Confirme ton adresse email en ouvrant ce lien :</p><p><a href="${url}">${url}</a></p><p>Ce lien expire dans 24h.</p>`,
    });
  }

  async sendNewEpisode(
    to: string,
    mediaTitle: string,
    body: string,
    path: string,
  ): Promise<void> {
    const url = `${this.webOrigin}${path}`;
    await this.send({
      to,
      subject: `Nouvel épisode : ${mediaTitle}`,
      text: `${mediaTitle} — ${body}\n\n${url}`,
      html: `<p><strong>${mediaTitle}</strong> — ${body}</p><p><a href="${url}">${url}</a></p>`,
    });
  }

  private async send({ to, subject, text, html }: SendArgs): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }
}
