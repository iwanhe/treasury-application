import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from './auth/auth.module';
import { CompanyAccessModule } from './company-access/company-access.module';
import { CompaniesController } from './company-access/companies.controller';
import { HealthController } from './health.controller';
import { TreasuryTicketsModule } from './treasury-tickets/treasury-tickets.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, CompanyAccessModule, TreasuryTicketsModule],
  controllers: [HealthController, CompaniesController]
})
export class AppModule {}
