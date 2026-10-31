import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
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

    const issuer = this.config.get<string>('OIDC_ISSUER');
    const audience = this.config.get<string>('OIDC_AUDIENCE');
    const jwksUri = this.config.get<string>('OIDC_JWKS_URI');

    if (!issuer || !audience || !jwksUri) {
      throw new ServiceUnavailableException('OIDC authentication is not configured.');
    }

    try {
      this.jwks ??= createRemoteJWKSet(new URL(jwksUri));
      const { payload } = await jwtVerify(authorization.slice(7), this.jwks, {
        issuer,
        audience,
        algorithms: ['RS256', 'ES256']
      });

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Token subject is missing.');
      }

      // The OIDC subject must be pre-provisioned as User.externalId by an administrator/identity sync.
      const user = await this.prisma.user.findUnique({
        where: { externalId: payload.sub },
        select: { id: true, email: true, status: true }
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User is not provisioned or active.');
      }

      const realmAccess = payload.realm_access;
      const roles =
        typeof realmAccess === 'object' &&
        realmAccess !== null &&
        'roles' in realmAccess &&
        Array.isArray(realmAccess.roles)
          ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
          : [];

      request.user = {
        userId: user.id,
        subject: payload.sub,
        email: user.email,
        roles
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
