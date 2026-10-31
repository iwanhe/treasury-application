import { PrismaClient, CompanyStatus, UserStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = [
    { code: 'REQUESTER', name: 'Requester' },
    { code: 'TREASURY_MAKER', name: 'Treasury Maker' },
    { code: 'TREASURY_CHECKER', name: 'Treasury Checker' },
    { code: 'APPROVER', name: 'Approver' },
    { code: 'ADMIN', name: 'Application Administrator' }
  ];
  for (const role of roles) {
    await prisma.role.upsert({ where: { code: role.code }, update: { name: role.name }, create: role });
  }
  const companies = [
    { code: 'DEMO-PT-A', name: 'Demo Company A', legalName: 'PT Demo Company A' },
    { code: 'DEMO-PT-B', name: 'Demo Company B', legalName: 'PT Demo Company B' }
  ];
  for (const company of companies) {
    await prisma.company.upsert({
      where: { code: company.code },
      update: { name: company.name, legalName: company.legalName, status: CompanyStatus.ACTIVE },
      create: company
    });
  }
  // Development fixture only. No password is created; production identity comes from SSO.
  const user = await prisma.user.upsert({
    where: { email: 'treasury.admin@example.test' },
    update: { fullName: 'Demo Treasury Administrator', status: UserStatus.ACTIVE },
    create: { email: 'treasury.admin@example.test', fullName: 'Demo Treasury Administrator' }
  });
  const [companyA, companyB, adminRole] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { code: 'DEMO-PT-A' } }),
    prisma.company.findUniqueOrThrow({ where: { code: 'DEMO-PT-B' } }),
    prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } })
  ]);
  for (const company of [companyA, companyB]) {
    await prisma.userCompanyRole.upsert({
      where: { userId_companyId_roleId: { userId: user.id, companyId: company.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, companyId: company.id, roleId: adminRole.id }
    });
  }
  console.log('Seed completed: roles, two demo companies, and one development-only admin identity.');
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
