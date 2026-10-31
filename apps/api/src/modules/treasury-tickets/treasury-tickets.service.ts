import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditAction, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';

const ticketSelect = {
  id: true, ticketNo: true, companyId: true, requesterId: true, assigneeId: true,
  type: true, title: true, description: true, status: true, priority: true,
  submittedAt: true, dueAt: true, completedAt: true, createdAt: true, updatedAt: true
} as const;

@Injectable()
export class TreasuryTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actorId: string, companyId: string, dto: CreateTicketDto) {
    return this.prisma.$transaction(async tx => {
      const company = await tx.company.findFirst({
        where: { id: companyId, status: 'ACTIVE' },
        select: { id: true, code: true }
      });
      if (!company) throw new NotFoundException('Company not found.');

      const year = new Date().getUTCFullYear();
      const counter = await tx.ticketCounter.upsert({
        where: { companyId_year: { companyId, year } },
        update: { lastValue: { increment: 1 } },
        create: { companyId, year, lastValue: 1 },
        select: { lastValue: true }
      });
      const ticketNo = `TR-${company.code}-${year}-${String(counter.lastValue).padStart(6, '0')}`;
      const ticket = await tx.treasuryTicket.create({
        data: {
          ticketNo, companyId, requesterId: actorId, type: dto.type,
          title: dto.title.trim(), description: dto.description.trim(),
          priority: dto.priority ?? 'NORMAL', status: TicketStatus.DRAFT
        },
        select: ticketSelect
      });
      await tx.auditLog.create({
        data: {
          actorId, ticketId: ticket.id, companyCode: company.code,
          action: AuditAction.CREATE, entityType: 'TREASURY_TICKET',
          entityId: ticket.id, afterData: { ticketNo, status: ticket.status, type: ticket.type }
        }
      });
      return ticket;
    });
  }

  async list(companyId: string, query: ListTicketsDto) {
    return this.prisma.treasuryTicket.findMany({
      where: { companyId, ...(query.status ? { status: query.status } : {}) },
      select: ticketSelect,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20
    });
  }

  async get(companyId: string, ticketId: string) {
    const ticket = await this.prisma.treasuryTicket.findFirst({
      where: { id: ticketId, companyId },
      select: {
        ...ticketSelect,
        approvals: {
          select: { id: true, sequence: true, roleCode: true, decision: true, comments: true, decidedAt: true },
          orderBy: { sequence: 'asc' }
        },
        attachments: {
          select: { id: true, originalName: true, contentType: true, sizeBytes: true, uploadedBy: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  async updateDraft(actorId: string, companyId: string, ticketId: string, dto: UpdateTicketDto) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({
        where: { id: ticketId, companyId },
        select: { id: true, ticketNo: true, requesterId: true, status: true, title: true, description: true, type: true, priority: true }
      });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new BadRequestException('Only the requester can edit this ticket.');
      if (existing.status !== TicketStatus.DRAFT) throw new BadRequestException('Only draft tickets can be edited.');

      const ticket = await tx.treasuryTicket.update({
        where: { id: ticketId },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {})
        },
        select: ticketSelect
      });
      await tx.auditLog.create({
        data: {
          actorId, ticketId, action: AuditAction.UPDATE, entityType: 'TREASURY_TICKET',
          entityId: ticketId,
          beforeData: { title: existing.title, description: existing.description, type: existing.type, priority: existing.priority },
          afterData: { title: ticket.title, description: ticket.description, type: ticket.type, priority: ticket.priority }
        }
      });
      return ticket;
    });
  }

  async submit(actorId: string, companyId: string, ticketId: string) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({
        where: { id: ticketId, companyId },
        select: { id: true, ticketNo: true, requesterId: true, status: true, company: { select: { code: true } } }
      });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new BadRequestException('Only the requester can submit this ticket.');
      if (existing.status !== TicketStatus.DRAFT) throw new BadRequestException('Only draft tickets can be submitted.');

      const ticket = await tx.treasuryTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.SUBMITTED, submittedAt: new Date() },
        select: ticketSelect
      });
      await tx.auditLog.create({
        data: {
          actorId, ticketId, companyCode: existing.company.code,
          action: AuditAction.SUBMIT, entityType: 'TREASURY_TICKET',
          entityId: ticketId,
          beforeData: { status: existing.status },
          afterData: { status: ticket.status, submittedAt: ticket.submittedAt?.toISOString() }
        }
      });
      return ticket;
    });
  }

  async cancel(actorId: string, companyId: string, ticketId: string) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.treasuryTicket.findFirst({
        where: { id: ticketId, companyId },
        select: { id: true, requesterId: true, status: true, company: { select: { code: true } } }
      });
      if (!existing) throw new NotFoundException('Ticket not found.');
      if (existing.requesterId !== actorId) throw new BadRequestException('Only the requester can cancel this ticket.');
      if (![TicketStatus.DRAFT, TicketStatus.SUBMITTED].includes(existing.status)) {
        throw new BadRequestException('Only draft or submitted tickets can be cancelled.');
      }
      const ticket = await tx.treasuryTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.CANCELLED },
        select: ticketSelect
      });
      await tx.auditLog.create({
        data: {
          actorId, ticketId, companyCode: existing.company.code,
          action: AuditAction.CANCEL, entityType: 'TREASURY_TICKET',
          entityId: ticketId, beforeData: { status: existing.status },
          afterData: { status: ticket.status }
        }
      });
      return ticket;
    });
  }
}
