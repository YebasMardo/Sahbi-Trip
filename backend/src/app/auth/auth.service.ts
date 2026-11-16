import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomInt } from 'node:crypto';
import dayjs from 'dayjs';
import { Model } from 'mongoose';
import { AppConfig } from 'src/core/config';
import { UsersService } from 'src/app/users/users.service';
import { UserDocument } from 'src/app/users/schemas/user.schema';
import usersStrings from 'src/app/users/users.strings';
import { TokensService } from 'src/app/tokens/tokens.service';
import { EmailMessengerService } from 'src/app/mail/email-messenger.service';
import {
  Otp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  OTPTypeEnum,
} from './schemas/otp.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  AuthStatusEnum,
  FullTokenPayload,
  OTPTokenPayload,
} from './types/jwt-token-payload';
import authStrings from './auth.strings';
import AuthResponseCode from './constants/auth-response-code.enum';

const OTP_EMAIL_TITLES: Record<OTPTypeEnum, string> = {
  [OTPTypeEnum.EMAIL_VERIFICATION]: 'Vérifiez votre adresse email',
  [OTPTypeEnum.PASSWORD_RESET]: 'Réinitialisation de votre mot de passe',
};

@Injectable()
export class AuthService {
  // Compared against on a login attempt for an unknown email, so the
  // response time doesn't reveal whether the account exists (A12).
  private readonly dummyHash: Promise<string>;

  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<Otp>,
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly emailMessenger: EmailMessengerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.dummyHash = this.tokensService.hashString(
      randomBytes(32).toString('hex'),
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(
        usersStrings.E_EMAIL_ALREADY_USED,
        AuthResponseCode.E_EMAIL_ALREADY_USED,
      );
    }

    const password = await this.tokensService.hashString(dto.password);
    const user = await this.usersService.create({
      fullname: dto.fullname,
      email: dto.email.toLowerCase(),
      password,
    });

    await this.emailMessenger.sendWelcomeEmail(user);
    return this.startEmailVerification(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const hashToCompare = user?.password ?? (await this.dummyHash);
    const matches = await this.tokensService.hashMatches(
      hashToCompare,
      dto.password,
    );

    if (!user || !matches) {
      throw new UnauthorizedException(
        authStrings.E_INVALID_CREDENTIALS,
        AuthResponseCode.E_INVALID_CREDENTIALS,
      );
    }

    if (user.banned) {
      throw new ForbiddenException(
        authStrings.E_ACCOUNT_BANNED,
        AuthResponseCode.E_ACCOUNT_BANNED,
      );
    }

    if (!user.emailVerified) {
      return this.startEmailVerification(user);
    }

    return this.issueSession(user);
  }

  async verifyEmail(email: string, dto: VerifyEmailDto) {
    const user = await this.findUserForOtpToken(email);
    if (user.emailVerified) {
      throw new BadRequestException(
        authStrings.E_EMAIL_ALREADY_VERIFIED,
        AuthResponseCode.E_EMAIL_ALREADY_VERIFIED,
      );
    }

    await this.consumeOtp(user, OTPTypeEnum.EMAIL_VERIFICATION, dto.code);
    const updated = await this.usersService.update(user._id.toString(), {
      emailVerified: true,
    });
    if (!updated) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }

    return this.issueSession(updated);
  }

  // Same response whether the token was for email verification or password
  // reset — the purpose comes from the token, not from a client-chosen route.
  async resendOtp(payload: OTPTokenPayload) {
    const user = await this.usersService.findByEmail(payload.email);
    if (user) {
      await this.issueOtp(user, payload.sub);
    }
    return { message: 'Si un compte existe, un nouveau code a été envoyé.' };
  }

  // Identical response whether or not the account exists (A12).
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      await this.issueOtp(user, OTPTypeEnum.PASSWORD_RESET);
    }
    const token = await this.issueOtpToken(
      OTPTypeEnum.PASSWORD_RESET,
      dto.email,
    );
    return {
      message:
        'Si un compte existe, un email de réinitialisation a été envoyé.',
      token,
    };
  }

  async resetPassword(email: string, dto: ResetPasswordDto) {
    const user = await this.findUserForOtpToken(email);
    await this.consumeOtp(user, OTPTypeEnum.PASSWORD_RESET, dto.code);

    const password = await this.tokensService.hashString(dto.password);
    await this.usersService.update(user._id.toString(), { password });
    return { message: 'Mot de passe modifié avec succès.' };
  }

  // Session-authenticated variant of `resetPassword`: no OTP, the current
  // password itself is the proof of ownership.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }

    const matches = await this.tokensService.hashMatches(
      user.password,
      dto.currentPassword,
    );
    if (!matches) {
      throw new UnauthorizedException(
        authStrings.E_CURRENT_PASSWORD_INVALID,
        AuthResponseCode.E_CURRENT_PASSWORD_INVALID,
      );
    }

    const password = await this.tokensService.hashString(dto.newPassword);
    await this.usersService.update(userId, { password });
    return { message: 'Mot de passe modifié avec succès.' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const userId = await this.tokensService.verifyAndRotate(dto.id, dto.value);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }
    return this.issueSession(user);
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    await this.tokensService.revoke(dto.id, userId);
    return { message: 'Déconnecté avec succès.' };
  }

  async me(userId: string): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }
    return user;
  }

  // `role` and `emailVerified` are deliberately not settable here: the role
  // decides authorization, and `emailVerified` only ever changes through
  // the OTP flow.
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException(
          usersStrings.E_EMAIL_ALREADY_USED,
          AuthResponseCode.E_EMAIL_ALREADY_USED,
        );
      }
    }

    const updated = await this.usersService.update(userId, {
      fullname: dto.fullname,
      email: dto.email?.toLowerCase(),
      avatarUrl: dto.avatarUrl,
    });
    if (!updated) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }
    return updated;
  }

  // ── private helpers ──────────────────────────────────────────────

  private async findUserForOtpToken(email: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException(
        authStrings.E_UNAUTHORIZED,
        AuthResponseCode.E_UNAUTHORIZED,
      );
    }
    return user;
  }

  private async startEmailVerification(user: UserDocument) {
    await this.issueOtp(user, OTPTypeEnum.EMAIL_VERIFICATION);
    const token = await this.issueOtpToken(
      OTPTypeEnum.EMAIL_VERIFICATION,
      user.email,
    );
    return { status: AuthStatusEnum.EMAIL_VERIFICATION_PENDING, token };
  }

  private async issueSession(user: UserDocument) {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.tokensService.issueRefreshToken(
      user._id.toString(),
    );
    return { status: AuthStatusEnum.OK, accessToken, refreshToken, user };
  }

  private issueAccessToken(user: UserDocument): Promise<string> {
    const expiresIn =
      this.configService.get('ACCESS_TOKEN_TIME_VALUE') +
      this.configService.get('ACCESS_TOKEN_TIME_UNIT');

    return this.jwtService.signAsync(
      {
        sub: user._id.toString(),
        role: user.role,
        ok: user.emailVerified,
      } satisfies FullTokenPayload,
      { expiresIn },
    );
  }

  private issueOtpToken(type: OTPTypeEnum, email: string): Promise<string> {
    const expiresIn =
      this.configService.get('ACCESS_TOKEN_TIME_VALUE') +
      this.configService.get('ACCESS_TOKEN_TIME_UNIT');

    return this.jwtService.signAsync(
      { sub: type, email } satisfies OTPTokenPayload,
      { expiresIn },
    );
  }

  private async issueOtp(user: UserDocument, type: OTPTypeEnum): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    const value = await this.tokensService.hashString(code);
    const expiresAt = dayjs().add(OTP_TTL_MINUTES, 'minute').toDate();

    await this.otpModel.findOneAndUpdate(
      { user: user._id, type },
      { value, expiresAt, attempts: 0 },
      { upsert: true, returnDocument: 'after' },
    );

    await this.emailMessenger.sendOtpEmail({
      user,
      title: OTP_EMAIL_TITLES[type],
      code,
      ttlMinutes: OTP_TTL_MINUTES,
    });
  }

  // fetch → exists → expiry → attempts → act (the OTP variant of the
  // ownership pattern — the "ownership" check is the token's email claim).
  private async consumeOtp(
    user: UserDocument,
    type: OTPTypeEnum,
    code: string,
  ): Promise<void> {
    const otp = await this.otpModel.findOne({ user: user._id, type });
    if (!otp) {
      throw new UnauthorizedException(
        authStrings.E_OTP_INVALID,
        AuthResponseCode.E_OTP_INVALID,
      );
    }
    if (otp.expiresAt < new Date()) {
      await this.otpModel.deleteOne({ _id: otp._id });
      throw new UnauthorizedException(
        authStrings.E_OTP_EXPIRED,
        AuthResponseCode.E_OTP_EXPIRED,
      );
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.otpModel.deleteOne({ _id: otp._id });
      throw new UnauthorizedException(
        authStrings.E_OTP_INVALID,
        AuthResponseCode.E_OTP_INVALID,
      );
    }

    const matches = await this.tokensService.hashMatches(otp.value, code);
    if (!matches) {
      await this.otpModel.updateOne(
        { _id: otp._id },
        { $inc: { attempts: 1 } },
      );
      throw new UnauthorizedException(
        authStrings.E_OTP_INVALID,
        AuthResponseCode.E_OTP_INVALID,
      );
    }

    await this.otpModel.deleteOne({ _id: otp._id });
  }
}
