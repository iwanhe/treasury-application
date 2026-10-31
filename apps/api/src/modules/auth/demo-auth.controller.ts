import { Body, Controller, ForbiddenException, Post, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SignJWT } from 'jose';
import { timingSafeEqual } from 'node:crypto';

const DEMO_IDENTITIES: Record<string, { externalId: string; label: string }> = {
  admin: { externalId: 'd1111111-1111-4111-8111-111111111111', label: 'Treasury Admin' },
  maker: { externalId: 'd2222222-2222-4222-8222-222222222222', label: 'Treasury Maker' },
  checker: { externalId: 'd3333333-3333-4333-8333-333333333333', label: 'Treasury Checker' }
};

@Controller('auth')
export class DemoAuthController {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  @Post('demo')
  async createDemoSession(@Body() body: { identity?: string; accessCode?: string }) {
    if (this.config.get('DEMO_AUTH_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('Demo authentication is disabled.');
    }
    const secretValue = this.config.get<string>('DEMO_TOKEN_SECRET');
    const accessCode = this.config.get<string>('DEMO_ACCESS_CODE');
    if (!secretValue || secretValue.length < 32 || !accessCode || accessCode.length < 12) {
      throw new ServiceUnavailableException('Demo authentication is not securely configured.');
    }
    const suppliedCode = typeof body?.accessCode === 'string' ? Buffer.from(body.accessCode) : Buffer.alloc(0);
    const expectedCode = Buffer.from(accessCode);
    if (suppliedCode.length !== expectedCode.length || !timingSafeEqual(suppliedCode, expectedCode)) {
      throw new ForbiddenException('Invalid demo access code.');
    }
    if (typeof body?.identity !== 'string' || !Object.hasOwn(DEMO_IDENTITIES, body.identity)) {
      throw new ForbiddenException('Demo identity is not allowed.');
    }
    const identity = DEMO_IDENTITIES[body.identity];
    const user = await this.prisma.user.findUnique({
      where: { externalId: identity.externalId },
      select: { id: true, email: true, fullName: true, status: true, externalId: true }
    });
    if (!user || user.status !== 'ACTIVE' || !user.externalId) {
      throw new ForbiddenException('Demo identity is not provisioned or active.');
    }
    const secret = new TextEncoder().encode(secretValue);
    const accessToken = await new SignJWT({ email: user.email, name: user.fullName, auth_mode: 'demo' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.externalId)
      .setIssuer('treasury-demo')
      .setAudience('treasury-api')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);
    return { accessToken, tokenType: 'Bearer', expiresIn: 7200, identity: identity.label };
  }
}
