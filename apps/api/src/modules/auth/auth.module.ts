import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { DemoAuthController } from './demo-auth.controller';
import { OidcJwtGuard } from './oidc-jwt.guard';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [DemoAuthController],
  providers: [OidcJwtGuard],
  exports: [OidcJwtGuard]
})
export class AuthModule {}
