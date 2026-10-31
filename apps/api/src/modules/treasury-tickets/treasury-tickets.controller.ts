import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard';
import { CompanyRolesGuard } from '../company-access/company-roles.guard';
import { RequireCompanyRoles } from '../company-access/company-roles.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { TreasuryTicketsService } from './treasury-tickets.service';

const COMPANY_TICKET_ROLES = ['REQUESTER', 'TREASURY_MAKER', 'TREASURY_CHECKER', 'APPROVER', 'ADMIN'];

@Controller('companies/:companyId/tickets')
@UseGuards(OidcJwtGuard, CompanyRolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class TreasuryTicketsController {
  constructor(private readonly tickets: TreasuryTicketsService) {}

  @Get()
  @RequireCompanyRoles(...COMPANY_TICKET_ROLES)
  list(@Param('companyId') companyId: string, @Query() query: ListTicketsDto) {
    return this.tickets.list(companyId, query);
  }

  @Post()
  @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  create(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('companyId') companyId: string,
    @Body() dto: CreateTicketDto
  ) {
    return this.tickets.create(user.userId, companyId, dto);
  }

  @Get(':ticketId')
  @RequireCompanyRoles(...COMPANY_TICKET_ROLES)
  get(@Param('companyId') companyId: string, @Param('ticketId') ticketId: string) {
    return this.tickets.get(companyId, ticketId);
  }

  @Patch(':ticketId')
  @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  updateDraft(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto
  ) {
    return this.tickets.updateDraft(user.userId, companyId, ticketId, dto);
  }

  @Post(':ticketId/submit')
  @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  submit(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string
  ) {
    return this.tickets.submit(user.userId, companyId, ticketId);
  }

  @Post(':ticketId/cancel')
  @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  cancel(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string
  ) {
    return this.tickets.cancel(user.userId, companyId, ticketId);
  }
}
