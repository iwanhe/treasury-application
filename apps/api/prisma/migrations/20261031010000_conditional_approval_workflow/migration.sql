ALTER TABLE "TreasuryTicket"
  ADD COLUMN "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currencyCode" CHAR(3) NOT NULL DEFAULT 'IDR';

ALTER TABLE "ApprovalRule"
  ALTER COLUMN "approverRoleCode" DROP NOT NULL,
  ADD COLUMN "currencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
  ADD COLUMN "minAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "maxAmount" DECIMAL(18,2),
  ADD COLUMN "approverUserId" UUID;

ALTER TABLE "TicketApproval"
  ALTER COLUMN "roleCode" DROP NOT NULL;

ALTER TABLE "ApprovalRule"
  ADD CONSTRAINT "ApprovalRule_approver_target_check"
    CHECK (("approverRoleCode" IS NOT NULL AND "approverUserId" IS NULL)
        OR ("approverRoleCode" IS NULL AND "approverUserId" IS NOT NULL)),
  ADD CONSTRAINT "ApprovalRule_amount_range_check"
    CHECK ("minAmount" >= 0 AND ("maxAmount" IS NULL OR "maxAmount" >= "minAmount"));

ALTER TABLE "ApprovalRule"
  ADD CONSTRAINT "ApprovalRule_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalRule_approverUserId_fkey"
    FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ApprovalRule_companyId_requestType_currencyCode_isActive_sequence_idx"
  ON "ApprovalRule"("companyId", "requestType", "currencyCode", "isActive", "sequence");
CREATE INDEX "ApprovalRule_approverUserId_idx" ON "ApprovalRule"("approverUserId");

-- Existing tickets are retained as IDR zero-value records until business owners backfill actual amounts.
