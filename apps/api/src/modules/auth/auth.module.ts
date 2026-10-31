import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OidcJwtGuard } from './oidc-jwt.guard';

@Module({
  imports: [ConfigModule],
  providers: [OidcJwtGuard],
  exports: [OidcJwtGuard]
})
export class AuthModule {}
