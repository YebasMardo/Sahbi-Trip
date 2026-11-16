import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicAccess } from './decorators/public-access.decorator';
import { OTPJwtSub } from './decorators/otp-jwt-sub.decorator';
import { OTPTypeEnum } from './schemas/otp.schema';
import { OTPTokenPayload } from './types/jwt-token-payload';
import {
  SuccessResponse,
  SuccessResponseEnum,
} from 'src/core/httpResponse/SuccessResponse';

const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @PublicAccess()
  @Throttle(AUTH_THROTTLE)
  @Post('/register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return new SuccessResponse(
      SuccessResponseEnum.CREATED,
      'Vérifiez votre boîte mail pour le code de confirmation.',
      result,
    );
  }

  @PublicAccess()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, result);
  }

  @ApiBearerAuth()
  @OTPJwtSub(OTPTypeEnum.EMAIL_VERIFICATION)
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/verify-email')
  async verifyEmail(@Req() request: Request, @Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(
      (request.user as unknown as OTPTokenPayload).email,
      dto,
    );
    return new SuccessResponse(
      SuccessResponseEnum.OK,
      'Email vérifié avec succès.',
      result,
    );
  }

  @ApiBearerAuth()
  @OTPJwtSub(OTPTypeEnum.EMAIL_VERIFICATION, OTPTypeEnum.PASSWORD_RESET)
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/resend-otp')
  async resendOtp(@Req() request: Request) {
    const result = await this.authService.resendOtp(
      request.user as unknown as OTPTokenPayload,
    );
    return new SuccessResponse(SuccessResponseEnum.OK, result.message);
  }

  @PublicAccess()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return new SuccessResponse(SuccessResponseEnum.OK, result.message, {
      token: result.token,
    });
  }

  @ApiBearerAuth()
  @OTPJwtSub(OTPTypeEnum.PASSWORD_RESET)
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/reset-password')
  async resetPassword(@Req() request: Request, @Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(
      (request.user as unknown as OTPTokenPayload).email,
      dto,
    );
    return new SuccessResponse(SuccessResponseEnum.OK, result.message);
  }

  @PublicAccess()
  @HttpCode(HttpStatus.OK)
  @Post('/refresh-token')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, result);
  }

  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('/change-password')
  async changePassword(
    @Req() request: Request,
    @Body() dto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.OK, result.message);
  }

  @ApiBearerAuth()
  @Get('/me')
  async me(@Req() request: Request) {
    const user = await this.authService.me(request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, user);
  }

  @ApiBearerAuth()
  @Patch('/me')
  async updateProfile(@Req() request: Request, @Body() dto: UpdateProfileDto) {
    const user = await this.authService.updateProfile(request.user.sub, dto);
    return new SuccessResponse(
      SuccessResponseEnum.OK,
      'Profil mis à jour avec succès.',
      user,
    );
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('/logout')
  async logout(@Req() request: Request, @Body() dto: RefreshTokenDto) {
    const result = await this.authService.logout(request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.OK, result.message);
  }
}
