import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfig } from 'src/core/config';
import { IS_PUBLIC_ACCESS_KEY } from '../decorators/public-access.decorator';
import { ONLY_ROLES_DECORATOR_KEY } from '../decorators/only-roles.decorator';
import { OTP_JWT_SUB_DECORATOR_KEY } from '../decorators/otp-jwt-sub.decorator';
import { UserRoleEnum } from 'src/app/users/schemas/user.schema';
import { UsersService } from 'src/app/users/users.service';
import { OTPTypeEnum } from '../schemas/otp.schema';
import {
  FullTokenPayload,
  JwtTokenPayload,
  OTPTokenPayload,
} from '../types/jwt-token-payload';
import authStrings from '../auth.strings';
import AuthResponseCode from '../constants/auth-response-code.enum';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException(
        authStrings.E_MISSING_CREDENTIALS,
        AuthResponseCode.E_MISSING_CREDENTIALS,
      );
    }

    let payload: JwtTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }

    if ('email' in payload) return this.checkOTPSubGuard(payload, context);
    return await this.checkFullGuard(payload, context);
  }

  private async checkFullGuard(
    payload: FullTokenPayload,
    context: ExecutionContext,
  ): Promise<boolean> {
    const { role, ok } = payload;

    if (!ok) {
      throw new ForbiddenException(
        authStrings.E_EMAIL_NOT_VERIFIED,
        AuthResponseCode.E_EMAIL_NOT_VERIFIED,
      );
    }

    // Re-checked against the DB (not the JWT payload) on every request so a
    // ban takes effect immediately instead of waiting out the access
    // token's lifetime.
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.banned) {
      throw new ForbiddenException(
        authStrings.E_ACCOUNT_BANNED,
        AuthResponseCode.E_ACCOUNT_BANNED,
      );
    }

    // getAllAndOverride, NOT get — otherwise class-level @OnlyRoles is
    // silently ignored and every admin route is wide open.
    const roles =
      this.reflector.getAllAndOverride<UserRoleEnum[]>(
        ONLY_ROLES_DECORATOR_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (Array.isArray(roles) && roles.length && !roles.includes(role)) {
      throw new ForbiddenException(
        authStrings.E_FORBIDDEN,
        AuthResponseCode.E_FORBIDDEN,
      );
    }

    context.switchToHttp().getRequest().user = payload;
    return true;
  }

  private checkOTPSubGuard(
    payload: OTPTokenPayload,
    context: ExecutionContext,
  ): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = payload;

    const allowed =
      this.reflector.getAllAndOverride<OTPTypeEnum[]>(
        OTP_JWT_SUB_DECORATOR_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (!allowed.includes(payload.sub)) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
