import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  /** User ID. */
  sub: string;
  email: string;
}

/** Injects the JWT payload of the authenticated user into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
