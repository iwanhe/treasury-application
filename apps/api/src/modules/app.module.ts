import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CompanyAccessModule } from './company-access/company-access.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule, CompanyAccessModule],
  controllers: [HealthController]
})
export class AppModule {}
