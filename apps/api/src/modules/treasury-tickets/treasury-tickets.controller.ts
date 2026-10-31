import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard';
import { CompanyRolesGuard } from '../company-access/company-roles.guard';
import { RequireCompanyRoles } from '../company-access/company-roles.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { CreateApprovalRuleDto } from './dto/create-approval-rule.dto';
import { UpdateApprovalRuleDto } from './dto/update-approval-rule.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { TreasuryTicketsService } from './treasury-tickets.service';
const COMPANY_TICKET_ROLES = ['REQUESTER', 'TREASURY_MAKER', 'TREASURY_CHECKER', 'APPROVER', 'ADMIN'];
@Controller('companies/:companyId')
@UseGuards(OidcJwtGuard, CompanyRolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class TreasuryTicketsController {
  constructor(private readonly tickets: TreasuryTicketsService) {}
  @Get('tickets') @RequireCompanyRoles(...COMPANY_TICKET_ROLES)
  list(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Query() query: ListTicketsDto) {
    return this.tickets.list(user.userId, companyId, query);
  }
  @Post('tickets') @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  create(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user.userId, companyId, dto);
  }
  @Get('tickets/:ticketId') @RequireCompanyRoles(...COMPANY_TICKET_ROLES)
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Param('ticketId') ticketId: string) {
    return this.tickets.get(user.userId, companyId, ticketId);
  }
  @Patch('tickets/:ticketId') @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  updateDraft(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.updateDraft(user.userId, companyId, ticketId, dto);
  }
  @Post('tickets/:ticketId/submit') @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  submit(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Param('ticketId') ticketId: string) {
    return this.tickets.submit(user.userId, companyId, ticketId);
  }
  @Post('tickets/:ticketId/cancel') @RequireCompanyRoles('REQUESTER', 'TREASURY_MAKER', 'ADMIN')
  cancel(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Param('ticketId') ticketId: string) {
    return this.tickets.cancel(user.userId, companyId, ticketId);
  }
  @Get('approval-rules') @RequireCompanyRoles('ADMIN', 'TREASURY_MAKER', 'TREASURY_CHECKER', 'APPROVER')
  listApprovalRules(@Param('companyId') companyId: string) { return this.tickets.listApprovalRules(companyId); }
  @Post('approval-rules') @RequireCompanyRoles('ADMIN')
  createApprovalRule(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string, @Body() dto: CreateApprovalRuleDto) {
    return this.tickets.createApprovalRule(user.userId, companyId, dto);
  }
  @Patch('approval-rules/:ruleId') @RequireCompanyRoles('ADMIN')
  updateApprovalRule(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string,
    @Param('ruleId') ruleId: string, @Body() dto: UpdateApprovalRuleDto) {
    return this.tickets.updateApprovalRule(user.userId, companyId, ruleId, dto);
  }
  @Get('approvals/pending') @RequireCompanyRoles('APPROVER', 'TREASURY_CHECKER', 'ADMIN')
  pendingApprovals(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string) {
    return this.tickets.pendingApprovals(user.userId, companyId);
  }
  @Post('tickets/:ticketId/approvals/:approvalId/decision') @RequireCompanyRoles('APPROVER', 'TREASURY_CHECKER', 'ADMIN')
  decideApproval(@CurrentUser() user: AuthenticatedPrincipal, @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string, @Param('approvalId') approvalId: string, @Body() dto: DecideApprovalDto) {
    return this.tickets.decideApproval(user.userId, companyId, ticketId, approvalId, dto);
  }
}
