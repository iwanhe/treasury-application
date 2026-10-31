import { Module } from '@nestjs/common';
import { CompanyAccessModule } from '../company-access/company-access.module';
import { TreasuryTicketsController } from './treasury-tickets.controller';
import { TreasuryTicketsService } from './treasury-tickets.service';

@Module({
  imports: [CompanyAccessModule],
  controllers: [TreasuryTicketsController],
  providers: [TreasuryTicketsService]
})
export class TreasuryTicketsModule {}
