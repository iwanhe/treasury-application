import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException
} from '@nestjs/common';
import { AuditAction, ApprovalDecision, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { CreateApprovalRuleDto } from './dto/create-approval-rule.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { selectApplicableApprovalRules } from './approval-policy';

const ticketSelect = {
  id: true, ticketNo: true, companyId: true, requesterId: true, assigneeId: true,
  type: true, title: true, description: true, amount: true, currencyCode: true,
  status: true, priority: true, submittedAt: true, dueAt: true, completedAt: true,
  createdAt: true, updatedAt: true
} as const;

@Injectable()
export class TreasuryTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actorId: string, companyId: string, dto: CreateTicketDto) {
    return this.prisma.$transaction(async tx => {
      const company = await tx.company.findFirst({ where: { id: companyId, status: 'ACTIVE' }, select: { id: true, code: true } });
      if (!company) throw new NotFoundException('Company not found.');
      const year = new Date().getUTCFullYear();
      const counter = await tx.ticketCounter.upsert({
        where: { companyId_year: { companyId, year } },
        update: { lastValue: { increment: 1 } }, create: { companyId, year, lastValue: 1 },
        select: { lastValue: true }
      });
      const ticketNo = `TR-${company.code}-${year}-${String(counter.lastValue).padStart(6, '0')}`;
      const ticket = await tx.treasuryTicket.create({
        data: { ticketNo, companyId, requesterId: actorId, type: dto.type, title: dto.title.trim(),
          description: dto.description.trim(), amount: new Prisma.Decimal(dto.amount),
          currencyCode: dto.currencyCode, priority: dto.priority ?? 'NORMAL', status: TicketStatus.DRAFT },
        select: ticketSelect
      });
      await tx.auditLog.create({ data: {
        actorId, ticketId: ticket.id, companyCode: company.code, action: AuditAction.CREATE,
        entityType: 'TREASURY_TICKET', entityId: ticket.id,
        afterData: { ticketNo, status: ticket.status, type: ticket.type, amount: dto.amount, currencyCode: dto.currencyCode }
      }});
      return ticket;
    });
  }

  private async canViewAllCompanyTickets(userId: string, companyId: string) {
    const elevated = await this.prisma.userCompanyRole.findFirst({
      where: { userId, companyId, role: { code: { in: ['TREASURY_MAKER', 'TREASURY_CHECKER', 'APPROVER', 'ADMIN'] } } },
      select: { id: true }
    });
    return Boolean(elevated);
  }

  async list(actorId: string, companyId: string, query: ListTicketsDto) {
    const canViewAll = await this.canViewAllCompanyTickets(actorId, companyId);
    return this.prisma.treasuryTicket.findMany({
      where: { companyId, ...(!canViewAll ? { requesterId: actorId } : {}), ...(query.status ? { status: query.status } : {}) },
      select: ticketSelect, orderBy: { createdAt: 'desc' }, take: query.limit ?? 20
    });
  }

  async get(actorId: string, companyId: string, ticketId: string) {
    const canViewAll = await this.canViewAllCompanyTickets(actorId, companyId);
    const ticket = await this.prisma.treasuryTicket.findFirst({
      where: { id: ticketId, companyId, ...(!canViewAll ? { requesterId: actorId } : {}) },
      select: { ...ticketSelect,
        approvals: { select: { id: true, sequence: true, approverId: true, roleCode: true, decision: true, comments: true, decidedAt: true }, orderBy: { sequence: 'asc' } },
        attachments: { select: { id: true, originalName: true, contentType: true, sizeBytes: true, uploadedBy: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
      }
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  async updateDraft(actorId: string, companyId: string, ticketId: string, dto: UpdateTicketDto) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({ where: { id: ticketId, companyId },
        select: { id: true, requesterId: true, status: true, title: true, description: true, type: true, priority: true, amount: true, currencyCode: true } });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new ForbiddenException('Only the requester can edit this ticket.');
      if (existing.status !== TicketStatus.DRAFT && existing.status !== TicketStatus.RETURNED) throw new BadRequestException('Only draft or returned tickets can be edited.');
      const ticket = await tx.treasuryTicket.update({ where: { id: ticketId }, data: {
        ...(dto.type != null ? { type: dto.type } : {}), ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.description != null ? { description: dto.description.trim() } : {}),
        ...(dto.priority != null ? { priority: dto.priority } : {}),
        ...(dto.amount != null ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.currencyCode != null ? { currencyCode: dto.currencyCode } : {})
      }, select: ticketSelect });
      await tx.auditLog.create({ data: { actorId, ticketId, action: AuditAction.UPDATE, entityType: 'TREASURY_TICKET',
        entityId: ticketId, beforeData: { title: existing.title, description: existing.description, type: existing.type,
          priority: existing.priority, amount: existing.amount.toString(), currencyCode: existing.currencyCode },
        afterData: { title: ticket.title, description: ticket.description, type: ticket.type, priority: ticket.priority,
          amount: ticket.amount.toString(), currencyCode: ticket.currencyCode } }});
      return ticket;
    });
  }

  async submit(actorId: string, companyId: string, ticketId: string) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({ where: { id: ticketId, companyId },
        select: { id: true, requesterId: true, status: true, type: true, amount: true, currencyCode: true, company: { select: { code: true } } } });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new ForbiddenException('Only the requester can submit this ticket.');
      if (existing.status !== TicketStatus.DRAFT && existing.status !== TicketStatus.RETURNED) throw new BadRequestException('Only draft or returned tickets can be submitted.');
      const candidateRules = await tx.approvalRule.findMany({
        where: { isActive: true, requestType: existing.type, currencyCode: existing.currencyCode,
          OR: [{ companyId }, { companyId: null }] },
        orderBy: { sequence: 'asc' }
      });
      const rules = selectApplicableApprovalRules(candidateRules, companyId, existing.currencyCode, existing.amount.toString());
      if (!rules.length) throw new BadRequestException('No active approval rule matches this company, transaction type, amount, and currency.');
      const previousCycle = await tx.ticketApproval.aggregate({ where: { ticketId }, _max: { cycle: true } });
      const cycle = (previousCycle._max.cycle ?? 0) + 1;
      await tx.ticketApproval.createMany({ data: rules.map(rule => ({
        ticketId, cycle, sequence: rule.sequence, approverId: rule.approverUserId, roleCode: rule.approverRoleCode,
        decision: ApprovalDecision.PENDING
      }))});
      const ticket = await tx.treasuryTicket.update({ where: { id: ticketId },
        data: { status: TicketStatus.IN_REVIEW, submittedAt: new Date() }, select: ticketSelect });
      await tx.auditLog.create({ data: { actorId, ticketId, companyCode: existing.company.code, action: AuditAction.SUBMIT,
        entityType: 'TREASURY_TICKET', entityId: ticketId,
        beforeData: { status: existing.status }, afterData: { status: ticket.status, amount: existing.amount.toString(),
          currencyCode: existing.currencyCode, approvalCycle: cycle, approvalSequences: rules.map(r => r.sequence) } }});
      return ticket;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async cancel(actorId: string, companyId: string, ticketId: string) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({ where: { id: ticketId, companyId },
        select: { id: true, requesterId: true, status: true, company: { select: { code: true } } } });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new ForbiddenException('Only the requester can cancel this ticket.');
      if (existing.status !== TicketStatus.DRAFT && existing.status !== TicketStatus.SUBMITTED) {
        throw new BadRequestException('Only draft or submitted tickets can be cancelled.');
      }
      const ticket = await tx.treasuryTicket.update({ where: { id: ticketId },
        data: { status: TicketStatus.CANCELLED }, select: ticketSelect });
      await tx.auditLog.create({ data: { actorId, ticketId, companyCode: existing.company.code,
        action: AuditAction.CANCEL, entityType: 'TREASURY_TICKET', entityId: ticketId,
        beforeData: { status: existing.status }, afterData: { status: ticket.status } } });
      return ticket;
    });
  }

  async createApprovalRule(actorId: string, companyId: string, dto: CreateApprovalRuleDto) {
    const min = new Prisma.Decimal(dto.minAmount);
    const max = dto.maxAmount ? new Prisma.Decimal(dto.maxAmount) : null;
    if (max && max.lessThan(min)) throw new BadRequestException('maxAmount must be greater than or equal to minAmount.');
    if (Boolean(dto.approverRoleCode) === Boolean(dto.approverUserId)) throw new BadRequestException('Specify exactly one approverRoleCode or approverUserId.');
    return this.prisma.$transaction(async tx => {
      const company = await tx.company.findFirst({ where: { id: companyId, status: 'ACTIVE' }, select: { id: true, code: true } });
      if (!company) throw new NotFoundException('Company not found.');
      if (dto.approverRoleCode) {
        if (!['APPROVER', 'TREASURY_CHECKER', 'ADMIN'].includes(dto.approverRoleCode)) {
          throw new BadRequestException('Approver role must be APPROVER, TREASURY_CHECKER, or ADMIN.');
        }
        const role = await tx.role.findUnique({ where: { code: dto.approverRoleCode }, select: { id: true } });
        if (!role) throw new NotFoundException('Approver role does not exist.');
      } else {
        const userMembership = await tx.userCompanyRole.findFirst({ where: { companyId, userId: dto.approverUserId,
          user: { status: 'ACTIVE' }, role: { code: { in: ['APPROVER', 'ADMIN'] } } }, select: { id: true } });
        if (!userMembership) throw new BadRequestException('Named approver must be an active APPROVER or ADMIN member of this company.');
      }
      const existing = await tx.approvalRule.findFirst({ where: { companyId, requestType: dto.requestType,
        currencyCode: dto.currencyCode, sequence: dto.sequence, isActive: true } });
      if (existing) throw new BadRequestException('An active rule already exists for this company, request type, currency, and sequence.');
      const rule = await tx.approvalRule.create({ data: { companyId, requestType: dto.requestType, sequence: dto.sequence,
        currencyCode: dto.currencyCode, minAmount: min, maxAmount: max,
        approverRoleCode: dto.approverRoleCode ?? null, approverUserId: dto.approverUserId ?? null } });
      await tx.auditLog.create({ data: { actorId, companyCode: company.code, action: AuditAction.CREATE,
        entityType: 'APPROVAL_RULE', entityId: rule.id, afterData: { requestType: rule.requestType, sequence: rule.sequence,
          currencyCode: rule.currencyCode, minAmount: rule.minAmount.toString(), maxAmount: rule.maxAmount?.toString() ?? null,
          approverRoleCode: rule.approverRoleCode, approverUserId: rule.approverUserId } }});
      return rule;
    });
  }

  async listApprovalRules(companyId: string) {
    return this.prisma.approvalRule.findMany({ where: { isActive: true, OR: [{ companyId }, { companyId: null }] },
      orderBy: [{ requestType: 'asc' }, { currencyCode: 'asc' }, { sequence: 'asc' }] });
  }

  async decideApproval(actorId: string, companyId: string, ticketId: string, approvalId: string, dto: DecideApprovalDto) {
    return this.prisma.$transaction(async tx => {
      const ticket = await tx.treasuryTicket.findFirst({ where: { id: ticketId, companyId },
        select: { id: true, requesterId: true, status: true, company: { select: { code: true } } } });
      if (!ticket) throw new NotFoundException('Ticket not found.');
      if (ticket.requesterId === actorId) throw new ForbiddenException('Maker-checker violation: requester cannot approve their own ticket.');
      if (ticket.status !== TicketStatus.IN_REVIEW) throw new BadRequestException('Ticket is not awaiting approval.');
      const pending = await tx.ticketApproval.findFirst({ where: { ticketId, decision: ApprovalDecision.PENDING },
        orderBy: { sequence: 'asc' } });
      if (!pending || pending.id !== approvalId) throw new BadRequestException('This approval is not the current pending approval step.');
      let authorized = pending.approverId === actorId;
      if (!authorized && pending.roleCode) {
        const membership = await tx.userCompanyRole.findFirst({ where: { userId: actorId, companyId,
          user: { status: 'ACTIVE' }, role: { code: pending.roleCode } }, select: { id: true } });
        authorized = Boolean(membership);
      }
      if (!authorized) throw new ForbiddenException('You are not assigned to this approval step.');
      if (pending.approverId && pending.approverId !== actorId) throw new ForbiddenException('Approval is assigned to another user.');
      const updatedApproval = await tx.ticketApproval.update({ where: { id: approvalId },
        data: { decision: dto.decision, comments: dto.comments?.trim() || null, approverId: actorId, decidedAt: new Date() } });
      let nextStatus: TicketStatus = TicketStatus.IN_REVIEW;
      if (dto.decision === 'REJECTED') nextStatus = TicketStatus.REJECTED;
      if (dto.decision === 'RETURNED') nextStatus = TicketStatus.RETURNED;
      if (dto.decision === 'APPROVED') {
        const next = await tx.ticketApproval.findFirst({ where: { ticketId, decision: ApprovalDecision.PENDING, sequence: { gt: pending.sequence } } });
        if (!next) nextStatus = TicketStatus.APPROVED;
      }
      if (nextStatus !== TicketStatus.IN_REVIEW) {
        await tx.ticketApproval.updateMany({ where: { ticketId, decision: ApprovalDecision.PENDING },
          data: { decision: ApprovalDecision.CANCELLED, comments: 'Cancelled because the approval process ended.' } });
      }
      await tx.treasuryTicket.update({ where: { id: ticketId }, data: { status: nextStatus } });
      const action = dto.decision === 'APPROVED' ? AuditAction.APPROVE : dto.decision === 'REJECTED' ? AuditAction.REJECT : AuditAction.RETURN;
      await tx.auditLog.create({ data: { actorId, ticketId, companyCode: ticket.company.code, action,
        entityType: 'TICKET_APPROVAL', entityId: updatedApproval.id,
        beforeData: { decision: ApprovalDecision.PENDING, ticketStatus: ticket.status },
        afterData: { decision: updatedApproval.decision, comments: updatedApproval.comments, ticketStatus: nextStatus } }});
      return { approval: updatedApproval, ticketStatus: nextStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async pendingApprovals(actorId: string, companyId: string) {
    const memberships = await this.prisma.userCompanyRole.findMany({ where: { userId: actorId, companyId },
      select: { role: { select: { code: true } } } });
    const roles = memberships.map(m => m.role.code);
    return this.prisma.ticketApproval.findMany({ where: { decision: ApprovalDecision.PENDING,
      ticket: { companyId, status: TicketStatus.IN_REVIEW, requesterId: { not: actorId } },
      OR: [{ approverId: actorId }, ...(roles.length ? [{ roleCode: { in: roles } }] : [])] },
      include: { ticket: { select: ticketSelect } }, orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }] });
  }
}
