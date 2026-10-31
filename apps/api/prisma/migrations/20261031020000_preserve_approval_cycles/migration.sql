ALTER TYPE "ApprovalDecision" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "TicketApproval" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TicketApproval" DROP INDEX IF EXISTS "TicketApproval_ticketId_sequence_key";
CREATE UNIQUE INDEX "TicketApproval_ticketId_cycle_sequence_key"
  ON "TicketApproval"("ticketId", "cycle", "sequence");
CREATE INDEX "TicketApproval_ticketId_cycle_decision_idx"
  ON "TicketApproval"("ticketId", "cycle", "decision");
