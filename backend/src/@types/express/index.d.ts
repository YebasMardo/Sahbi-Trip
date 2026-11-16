import { JwtTokenPayload } from 'src/app/auth/types/jwt-token-payload';

declare global {
  namespace Express {
    interface Request {
      user: JwtTokenPayload & { sub: string };
    }
  }
}
