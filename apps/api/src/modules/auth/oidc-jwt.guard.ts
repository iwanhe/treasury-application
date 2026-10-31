import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class OidcJwtGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required.');
    }

    const token = authorization.slice(7);
    try {
      const decoded = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { iss?: string };
      let payload: JWTPayload;
      if (decoded.iss === 'treasury-demo') {
        if (this.config.get('DEMO_AUTH_ENABLED') !== 'true') {
          throw new UnauthorizedException('Demo authentication is disabled.');
        }
        const secretValue = this.config.get<string>('DEMO_TOKEN_SECRET');
        if (!secretValue || secretValue.length < 32) {
          throw new ServiceUnavailableException('Demo authentication is not securely configured.');
        }
        const secret = new TextEncoder().encode(secretValue);
        ({ payload } = await jwtVerify(token, secret, {
          issuer: 'treasury-demo',
          audience: 'treasury-api',
          algorithms: ['HS256']
        }));
      } else {
        const issuer = this.config.get<string>('OIDC_ISSUER');
        const audience = this.config.get<string>('OIDC_AUDIENCE');
        const jwksUri = this.config.get<string>('OIDC_JWKS_URI');
        if (!issuer || !audience || !jwksUri) {
          throw new ServiceUnavailableException('OIDC authentication is not configured.');
        }
        this.jwks ??= createRemoteJWKSet(new URL(jwksUri));
        ({ payload } = await jwtVerify(token, this.jwks, {
          issuer, audience, algorithms: ['RS256', 'ES256']
        }));
      }

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Token subject is missing.');
      }
      const user = await this.prisma.user.findUnique({
        where: { externalId: payload.sub },
        select: { id: true, email: true, status: true }
      });
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User is not provisioned or active.');
      }

      const realmAccess = payload.realm_access;
      const roles =
        typeof realmAccess === 'object' && realmAccess !== null &&
        'roles' in realmAccess && Array.isArray(realmAccess.roles)
          ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
          : [];
      request.user = { userId: user.id, subject: payload.sub, email: user.email, roles };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
