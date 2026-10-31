CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "RequestType" AS ENUM ('BANK_ACCOUNT_OPEN', 'BANK_ACCOUNT_CLOSE', 'INTERNET_BANKING', 'FINANCIAL_INVESTMENT', 'FX_DEAL', 'FUNDING_LOAN', 'FACILITY_EXTENSION', 'OTHER');
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'LOGIN', 'LOGOUT', 'EXPORT', 'UPLOAD');

CREATE TABLE "Company" (
  "id" UUID NOT NULL, "code" VARCHAR(30) NOT NULL, "name" VARCHAR(200) NOT NULL,
  "legalName" VARCHAR(250), "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "User" (
  "id" UUID NOT NULL, "email" VARCHAR(254) NOT NULL, "fullName" VARCHAR(160) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "externalId" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Role" (
  "id" UUID NOT NULL, "code" VARCHAR(50) NOT NULL, "name" VARCHAR(100) NOT NULL,
  "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserCompanyRole" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "companyId" UUID NOT NULL, "roleId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCompanyRole_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketCounter" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "year" INTEGER NOT NULL, "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketCounter_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TreasuryTicket" (
  "id" UUID NOT NULL, "ticketNo" VARCHAR(40) NOT NULL, "companyId" UUID NOT NULL, "requesterId" UUID NOT NULL,
  "assigneeId" UUID, "type" "RequestType" NOT NULL, "title" VARCHAR(200) NOT NULL, "description" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "currencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
  "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT', "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
  "submittedAt" TIMESTAMP(3), "dueAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryTicket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApprovalRule" (
  "id" UUID NOT NULL, "companyId" UUID, "requestType" "RequestType" NOT NULL, "sequence" INTEGER NOT NULL,
  "currencyCode" CHAR(3) NOT NULL, "minAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "maxAmount" DECIMAL(18,2),
  "approverRoleCode" VARCHAR(50), "approverUserId" UUID, "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalRule_approver_target_check" CHECK (("approverRoleCode" IS NOT NULL AND "approverUserId" IS NULL) OR ("approverRoleCode" IS NULL AND "approverUserId" IS NOT NULL)),
  CONSTRAINT "ApprovalRule_amount_range_check" CHECK ("minAmount" >= 0 AND ("maxAmount" IS NULL OR "maxAmount" >= "minAmount"))
);
CREATE TABLE "TicketApproval" (
  "id" UUID NOT NULL, "ticketId" UUID NOT NULL, "cycle" INTEGER NOT NULL DEFAULT 1, "sequence" INTEGER NOT NULL,
  "approverId" UUID, "roleCode" VARCHAR(50), "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
  "comments" TEXT, "decidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketApproval_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketAttachment" (
  "id" UUID NOT NULL, "ticketId" UUID NOT NULL, "originalName" VARCHAR(255) NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL, "contentType" VARCHAR(150) NOT NULL, "sizeBytes" BIGINT NOT NULL,
  "uploadedBy" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL, "actorId" UUID, "ticketId" UUID, "companyCode" VARCHAR(30),
  "action" "AuditAction" NOT NULL, "entityType" VARCHAR(80) NOT NULL, "entityId" VARCHAR(80),
  "beforeData" JSONB, "afterData" JSONB, "ipAddress" VARCHAR(45), "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");
CREATE INDEX "Company_status_name_idx" ON "Company"("status", "name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "UserCompanyRole_userId_companyId_roleId_key" ON "UserCompanyRole"("userId", "companyId", "roleId");
CREATE INDEX "UserCompanyRole_companyId_roleId_idx" ON "UserCompanyRole"("companyId", "roleId");
CREATE INDEX "UserCompanyRole_userId_companyId_idx" ON "UserCompanyRole"("userId", "companyId");
CREATE UNIQUE INDEX "TicketCounter_companyId_year_key" ON "TicketCounter"("companyId", "year");
CREATE UNIQUE INDEX "TreasuryTicket_ticketNo_key" ON "TreasuryTicket"("ticketNo");
CREATE INDEX "TreasuryTicket_companyId_status_createdAt_idx" ON "TreasuryTicket"("companyId", "status", "createdAt");
CREATE INDEX "TreasuryTicket_requesterId_createdAt_idx" ON "TreasuryTicket"("requesterId", "createdAt");
CREATE INDEX "TreasuryTicket_assigneeId_status_idx" ON "TreasuryTicket"("assigneeId", "status");
CREATE INDEX "TreasuryTicket_dueAt_status_idx" ON "TreasuryTicket"("dueAt", "status");
CREATE INDEX "ApprovalRule_companyId_requestType_currencyCode_isActive_sequence_idx" ON "ApprovalRule"("companyId", "requestType", "currencyCode", "isActive", "sequence");
CREATE INDEX "ApprovalRule_approverUserId_idx" ON "ApprovalRule"("approverUserId");
CREATE UNIQUE INDEX "TicketApproval_ticketId_cycle_sequence_key" ON "TicketApproval"("ticketId", "cycle", "sequence");
CREATE INDEX "TicketApproval_approverId_decision_idx" ON "TicketApproval"("approverId", "decision");
CREATE INDEX "TicketApproval_ticketId_cycle_decision_idx" ON "TicketApproval"("ticketId", "cycle", "decision");
CREATE UNIQUE INDEX "TicketAttachment_storageKey_key" ON "TicketAttachment"("storageKey");
CREATE INDEX "TicketAttachment_ticketId_createdAt_idx" ON "TicketAttachment"("ticketId", "createdAt");
CREATE INDEX "AuditLog_companyCode_createdAt_idx" ON "AuditLog"("companyCode", "createdAt");
CREATE INDEX "AuditLog_ticketId_createdAt_idx" ON "AuditLog"("ticketId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

ALTER TABLE "UserCompanyRole" ADD CONSTRAINT "UserCompanyRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompanyRole" ADD CONSTRAINT "UserCompanyRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserCompanyRole" ADD CONSTRAINT "UserCompanyRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketCounter" ADD CONSTRAINT "TicketCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryTicket" ADD CONSTRAINT "TreasuryTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryTicket" ADD CONSTRAINT "TreasuryTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryTicket" ADD CONSTRAINT "TreasuryTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TreasuryTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TreasuryTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TreasuryTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
