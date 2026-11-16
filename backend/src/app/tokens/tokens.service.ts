import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import { Model, Types } from 'mongoose';
import { AppConfig } from 'src/core/config';
import { Token, TokenDocument } from './schemas/token.schema';

export interface IssuedRefreshToken {
  id: string;
  value: string;
}

interface RefreshTokenJwtPayload {
  sub: string;
}

@Injectable()
export class TokensService {
  constructor(
    @InjectModel(Token.name) private readonly tokenModel: Model<Token>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  hashString(value: string): Promise<string> {
    return argon2.hash(value);
  }

  async hashMatches(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      // any error → no match; never leak the reason
    }
    return false;
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const expiresIn =
      this.configService.get('REFRESH_TOKEN_TIME_VALUE') +
      this.configService.get('REFRESH_TOKEN_TIME_UNIT');

    const value = await this.jwtService.signAsync(
      { sub: userId } satisfies RefreshTokenJwtPayload,
      { expiresIn },
    );

    const expiresAt = dayjs()
      .add(
        Number(this.configService.get('REFRESH_TOKEN_TIME_VALUE')),
        this.configService.get('REFRESH_TOKEN_TIME_UNIT') as dayjs.ManipulateType,
      )
      .toDate();

    const doc: TokenDocument = await this.tokenModel.create({
      user: new Types.ObjectId(userId),
      value: await this.hashString(value),
      expiresAt,
    });

    return { id: doc._id.toString(), value };
  }

  // Verifies the presented refresh token, deletes it (single use), and
  // returns the user id it was issued to — the caller issues a new pair.
  async verifyAndRotate(id: string, value: string): Promise<string> {
    let payload: RefreshTokenJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenJwtPayload>(
        value,
        { secret: this.configService.get('JWT_SECRET') },
      );
    } catch {
      throw new UnauthorizedException(
        'Session invalide, veuillez vous reconnecter.',
      );
    }

    const token = await this.tokenModel.findOne({
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(payload.sub),
    });
    if (!token) {
      throw new UnauthorizedException(
        'Session invalide, veuillez vous reconnecter.',
      );
    }

    const matches = await this.hashMatches(token.value, value);
    if (!matches) {
      throw new UnauthorizedException(
        'Session invalide, veuillez vous reconnecter.',
      );
    }

    await this.tokenModel.deleteOne({ _id: token._id });
    return payload.sub;
  }

  // Ownership-scoped revoke, used by logout. 404 for both "absent" and
  // "not yours" — never confirm whether a token id exists to a stranger.
  async revoke(id: string, userId: string): Promise<void> {
    const token = await this.tokenModel.findById(new Types.ObjectId(id));
    if (!token) throw new NotFoundException('Session introuvable.');

    const ownerId = '_id' in token.user ? token.user._id : token.user;
    if (ownerId.toString() !== userId) {
      throw new NotFoundException('Session introuvable.');
    }
    await this.tokenModel.deleteOne({ _id: token._id });
  }
}
