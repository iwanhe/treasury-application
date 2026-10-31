CREATE TABLE "TicketCounter" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketCounter_companyId_year_key"
  ON "TicketCounter"("companyId", "year");

ALTER TABLE "TicketCounter"
  ADD CONSTRAINT "TicketCounter_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
