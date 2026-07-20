import {
  type CanActivate,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isSocialEnabled } from "./social.config";

/**
 * Gates every social endpoint behind the runtime SOCIAL_ENABLED flag. Throws
 * 404 (not 403) when disabled so a self-host install doesn't even advertise the
 * social surface. Runs after the global JwtAuthGuard.
 */
@Injectable()
export class SocialFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!isSocialEnabled(this.config)) {
      throw new NotFoundException();
    }

    return true;
  }
}
