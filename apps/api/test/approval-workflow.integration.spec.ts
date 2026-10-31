import { after, before, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaClient, RequestType } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TreasuryTicketsService } from '../src/modules/treasury-tickets/treasury-tickets.service';

const prisma = new PrismaClient();
const service = new TreasuryTicketsService(prisma as never);
type Fixture = { companyId: string; otherCompanyId: string; requesterId: string; approverId: string; secondApproverId: string; companyCode: string; globalRuleIds: string[] };
const roleCodes = ['REQUESTER', 'APPROVER', 'TREASURY_CHECKER', 'ADMIN'];

async function fixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const company = await prisma.company.create({ data: { code: `T${suffix}`, name: 'Workflow test company' } });
  const other = await prisma.company.create({ data: { code: `O${suffix}`, name: 'Other test company' } });
  const users = await Promise.all(['requester', 'approver', 'approver2'].map((name, i) =>
    prisma.user.create({ data: { email: `${name}.${suffix.toLowerCase()}@example.test`, fullName: name } })));
  const roles = await Promise.all(roleCodes.map(code => prisma.role.upsert({
    where: { code }, update: {}, create: { code, name: code }
  })));
  const roleByCode = new Map(roles.map(r => [r.code, r.id]));
  await prisma.userCompanyRole.createMany({ data: [
    { userId: users[0].id, companyId: company.id, roleId: roleByCode.get('REQUESTER')! },
    { userId: users[1].id, companyId: company.id, roleId: roleByCode.get('APPROVER')! },
    { userId: users[2].id, companyId: company.id, roleId: roleByCode.get('APPROVER')! }
  ]});
  return { companyId: company.id, otherCompanyId: other.id, requesterId: users[0].id,
    approverId: users[1].id, secondApproverId: users[2].id, companyCode: company.code };
}
async function cleanup(f: Fixture) {
  await prisma.auditLog.deleteMany({ where: { companyCode: { in: [f.companyCode] } } });
  const tickets = await prisma.treasuryTicket.findMany({ where: { companyId: f.companyId }, select: { id: true } });
  const ids = tickets.map(t => t.id);
  await prisma.ticketApproval.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticketAttachment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.treasuryTicket.deleteMany({ where: { id: { in: ids } } });
  await prisma.approvalRule.deleteMany({ where: { OR: [{ companyId: f.companyId }, { id: { in: f.globalRuleIds } }] } });
  await prisma.ticketCounter.deleteMany({ where: { companyId: f.companyId } });
  await prisma.userCompanyRole.deleteMany({ where: { companyId: { in: [f.companyId, f.otherCompanyId] } } });
  await prisma.company.deleteMany({ where: { id: { in: [f.companyId, f.otherCompanyId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [f.requesterId, f.approverId, f.secondApproverId] } } });
}
async function addRule(f: Fixture, sequence: number, roleCode = 'APPROVER', minAmount = '0', maxAmount?: string) {
  return prisma.approvalRule.create({ data: { companyId: f.companyId, requestType: RequestType.FINANCIAL_INVESTMENT,
    sequence, currencyCode: 'IDR', minAmount, maxAmount, approverRoleCode: roleCode } });
}
async function addGlobalRule(sequence: number, roleCode = 'APPROVER', minAmount = '0') {
  return prisma.approvalRule.create({ data: { companyId: null, requestType: RequestType.FINANCIAL_INVESTMENT,
    sequence, currencyCode: 'IDR', minAmount, approverRoleCode: roleCode } });
}
async function createAndSubmit(f: Fixture, amount = '1000000') {
  const ticket = await service.create(f.requesterId, f.companyId, {
    type: RequestType.FINANCIAL_INVESTMENT, title: 'Workflow test', description: 'Integration test',
    amount, currencyCode: 'IDR'
  });
  await service.submit(f.requesterId, f.companyId, ticket.id);
  return ticket;
}
async function approvals(ticketId: string) {
  return prisma.ticketApproval.findMany({ where: { ticketId }, orderBy: [{ cycle: 'asc' }, { sequence: 'asc' }] });
}

before(async () => { await prisma.$connect(); });
after(async () => { await prisma.$disconnect(); });

describe('conditional approval workflow integration', () => {
  it('selects company rules ahead of global rules and matches amount boundaries', async () => {
    const f = await fixture();
    try {
      await addGlobalRule(f, 1, 'TREASURY_CHECKER');
      await addRule(f, 1, 'APPROVER', '1000000', '2000000');
      const ticket = await createAndSubmit(f, '2000000.00');
      const steps = await approvals(ticket.id);
      assert.equal(steps.length, 1);
      assert.equal(steps[0].roleCode, 'APPROVER');
    } finally { await cleanup(f); }
  });

  it('uses a global rule only when no company-specific amount rule matches', async () => {
    const f = await fixture();
    try {
      await addGlobalRule(f, 1);
      await addRule(f, 1, 'TREASURY_CHECKER', '5000000');
      const ticket = await createAndSubmit(f, '1000000');
      const steps = await approvals(ticket.id);
      assert.equal(steps[0].roleCode, 'APPROVER');
    } finally { await cleanup(f); }
  });

  it('rejects submission when no rule matches the amount and currency', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1, 'APPROVER', '5000000', '9000000');
      const ticket = await service.create(f.requesterId, f.companyId, {
        type: RequestType.FINANCIAL_INVESTMENT, title: 'Out of band', description: 'No matching rule',
        amount: '1000000', currencyCode: 'IDR'
      });
      await assert.rejects(() => service.submit(f.requesterId, f.companyId, ticket.id), BadRequestException);
      assert.equal((await prisma.treasuryTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, 'DRAFT');
    } finally { await cleanup(f); }
  });

  it('requires approvals in order and only completes after the final approval', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1, 'APPROVER');
      await addRule(f, 2, 'TREASURY_CHECKER');
      await prisma.userCompanyRole.create({ data: { userId: f.approverId, companyId: f.companyId,
        role: { connect: { code: 'TREASURY_CHECKER' } } } });
      const ticket = await createAndSubmit(f);
      const steps = await approvals(ticket.id);
      await assert.rejects(() => service.decideApproval(f.approverId, f.companyId, ticket.id, steps[1].id,
        { decision: 'APPROVED' }), BadRequestException);
      await service.decideApproval(f.approverId, f.companyId, ticket.id, steps[0].id, { decision: 'APPROVED' });
      assert.equal((await prisma.treasuryTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, 'IN_REVIEW');
      await service.decideApproval(f.approverId, f.companyId, ticket.id, steps[1].id, { decision: 'APPROVED' });
      assert.equal((await prisma.treasuryTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, 'APPROVED');
      assert.equal((await prisma.auditLog.count({ where: { ticketId: ticket.id, action: 'APPROVE' } })), 2);
    } finally { await cleanup(f); }
  });

  it('rejects or returns a ticket and cancels remaining steps', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1, 'APPROVER');
      await addRule(f, 2, 'TREASURY_CHECKER');
      const ticket = await createAndSubmit(f);
      const steps = await approvals(ticket.id);
      await service.decideApproval(f.approverId, f.companyId, ticket.id, steps[0].id,
        { decision: 'RETURNED', comments: 'Please revise' });
      assert.equal((await prisma.treasuryTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status, 'RETURNED');
      const history = await approvals(ticket.id);
      assert.equal(history[1].decision, 'CANCELLED');
      assert.equal(await prisma.auditLog.count({ where: { ticketId: ticket.id, action: 'RETURN' } }), 1);
    } finally { await cleanup(f); }
  });

  it('keeps prior decisions when a returned ticket is resubmitted', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1, 'APPROVER');
      await addRule(f, 2, 'TREASURY_CHECKER');
      const ticket = await createAndSubmit(f);
      const first = await approvals(ticket.id);
      await service.decideApproval(f.approverId, f.companyId, ticket.id, first[0].id, { decision: 'RETURNED' });
      await service.submit(f.requesterId, f.companyId, ticket.id);
      const history = await approvals(ticket.id);
      assert.deepEqual(history.map(a => a.cycle), [1, 1, 2, 2]);
      assert.equal(history[0].decision, 'RETURNED');
      assert.equal(history[1].decision, 'CANCELLED');
      assert.equal(history[2].decision, 'PENDING');
      assert.equal(await prisma.auditLog.count({ where: { ticketId: ticket.id, action: 'SUBMIT' } }), 2);
    } finally { await cleanup(f); }
  });

  it('enforces maker-checker separation', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1);
      const ticket = await createAndSubmit(f);
      const step = (await approvals(ticket.id))[0];
      await assert.rejects(() => service.decideApproval(f.requesterId, f.companyId, ticket.id, step.id,
        { decision: 'APPROVED' }), ForbiddenException);
      assert.equal((await approvals(ticket.id))[0].decision, 'PENDING');
    } finally { await cleanup(f); }
  });

  it('prevents cross-company ticket visibility and decisions', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1);
      const ticket = await createAndSubmit(f);
      await assert.rejects(() => service.get(f.approverId, f.otherCompanyId, ticket.id), NotFoundException);
      const step = (await approvals(ticket.id))[0];
      await assert.rejects(() => service.decideApproval(f.approverId, f.otherCompanyId, ticket.id, step.id,
        { decision: 'APPROVED' }), NotFoundException);
    } finally { await cleanup(f); }
  });

  it('allows at most one concurrent decision for the same pending step', async () => {
    const f = await fixture();
    try {
      await addRule(f, 1);
      const ticket = await createAndSubmit(f);
      const step = (await approvals(ticket.id))[0];
      const results = await Promise.allSettled([
        service.decideApproval(f.approverId, f.companyId, ticket.id, step.id, { decision: 'APPROVED' }),
        service.decideApproval(f.secondApproverId, f.companyId, ticket.id, step.id, { decision: 'APPROVED' })
      ]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const stored = await prisma.ticketApproval.findUniqueOrThrow({ where: { id: step.id } });
      assert.equal(stored.decision, 'APPROVED');
      assert.equal(await prisma.auditLog.count({ where: { ticketId: ticket.id, action: 'APPROVE' } }), 1);
    } finally { await cleanup(f); }
  });
});
