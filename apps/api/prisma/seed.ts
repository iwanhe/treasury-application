import { PrismaClient, CompanyStatus, UserStatus, RequestType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_USERS = [
  { externalId: 'd1111111-1111-4111-8111-111111111111', email: 'treasury.admin@example.local', fullName: 'Treasury Administrator', roles: ['ADMIN', 'APPROVER', 'REQUESTER'] },
  { externalId: 'd2222222-2222-4222-8222-222222222222', email: 'treasury.maker@example.local', fullName: 'Treasury Maker', roles: ['REQUESTER', 'TREASURY_MAKER'] },
  { externalId: 'd3333333-3333-4333-8333-333333333333', email: 'treasury.checker@example.local', fullName: 'Treasury Checker', roles: ['TREASURY_CHECKER'] }
] as const;

async function main() {
  const roles = [
    { code: 'REQUESTER', name: 'Requester' },
    { code: 'TREASURY_MAKER', name: 'Treasury Maker' },
    { code: 'TREASURY_CHECKER', name: 'Treasury Checker' },
    { code: 'APPROVER', name: 'Approver' },
    { code: 'ADMIN', name: 'Application Administrator' }
  ];
  for (const role of roles) await prisma.role.upsert({ where: { code: role.code }, update: { name: role.name }, create: role });

  const companies = [
    { code: 'DEMO-PT-A', name: 'Demo Company A', legalName: 'PT Demo Company A' },
    { code: 'DEMO-PT-B', name: 'Demo Company B', legalName: 'PT Demo Company B' }
  ];
  for (const company of companies) await prisma.company.upsert({
    where: { code: company.code }, update: { name: company.name, legalName: company.legalName, status: CompanyStatus.ACTIVE }, create: company
  });

  const companyRows = await prisma.company.findMany({ where: { code: { in: companies.map(c => c.code) } } });
  const roleRows = await prisma.role.findMany({ where: { code: { in: roles.map(r => r.code) } } });
  const roleId = new Map(roleRows.map(r => [r.code, r.id]));
  const users = new Map<string, string>();
  for (const fixture of DEMO_USERS) {
    const dbUser = await prisma.user.upsert({
      where: { externalId: fixture.externalId },
      update: { email: fixture.email, fullName: fixture.fullName, status: UserStatus.ACTIVE },
      create: { externalId: fixture.externalId, email: fixture.email, fullName: fixture.fullName, status: UserStatus.ACTIVE }
    });
    users.set(fixture.email, dbUser.id);
    for (const company of companyRows) for (const code of fixture.roles) {
      const id = roleId.get(code);
      if (!id) throw new Error('Missing role fixture: ' + code);
      await prisma.userCompanyRole.upsert({
        where: { userId_companyId_roleId: { userId: dbUser.id, companyId: company.id, roleId: id } },
        update: {}, create: { userId: dbUser.id, companyId: company.id, roleId: id }
      });
    }
  }

  for (const company of companyRows) for (const requestType of Object.values(RequestType)) {
    const definitions = [
      { sequence: 1, approverRoleCode: 'TREASURY_CHECKER', approverUserId: null },
      { sequence: 2, approverRoleCode: 'APPROVER', approverUserId: null }
    ];
    for (const rule of definitions) {
      const existingRule = await prisma.approvalRule.findFirst({
        where: { companyId: company.id, requestType, sequence: rule.sequence, currencyCode: 'IDR' }
      });
      const ruleData = { companyId: company.id, requestType, sequence: rule.sequence, currencyCode: 'IDR',
        minAmount: new Prisma.Decimal(0), maxAmount: null, approverRoleCode: rule.approverRoleCode, approverUserId: null, isActive: true };
      if (existingRule) await prisma.approvalRule.update({ where: { id: existingRule.id }, data: ruleData });
      else await prisma.approvalRule.create({ data: ruleData });
    }
  }
  console.log('Demo seed complete: 2 companies, 3 identities, company roles, and two-step IDR approval rules for every request type.');
  console.log('Keycloak demo users must change their temporary password on first login.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
