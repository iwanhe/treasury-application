import { expect, test, type Page } from '@playwright/test';

const maker = { username: 'treasury.maker', password: 'ChangeMe123!' };
const checker = { username: 'treasury.checker', password: 'ChangeMe123!' };
const admin = { username: 'treasury.admin', password: 'ChangeMe123!' };

async function login(page: Page, credentials: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Username or email').fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Approval Rule Administration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Treasury Ticket Management' })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page.getByLabel('Username or email')).toBeVisible();
}

async function createAndSubmitTicket(page: Page, title: string) {
  await page.getByRole('button', { name: '+ Buat pengajuan' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Judul').fill(title);
  await dialog.getByLabel('Deskripsi / kebutuhan').fill('Automated Playwright acceptance test');
  await dialog.getByLabel('Nominal').fill('1500000');
  await dialog.getByRole('button', { name: 'Simpan draft' }).click();
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(row.getByText('IN REVIEW')).toBeVisible();
}

test('Maker → Checker → Admin approval and return/edit/resubmit lifecycle', async ({ page }) => {
  const suffix = Date.now().toString();
  const approvalTitle = `E2E approval ${suffix}`;
  const returnTitle = `E2E return ${suffix}`;

  await login(page, maker);
  await createAndSubmitTicket(page, approvalTitle);
  await createAndSubmitTicket(page, returnTitle);
  await logout(page);

  await login(page, checker);
  const approvalInbox = page.locator('.ant-card').filter({ has: page.getByRole('heading', { name: 'Approval Inbox' }) });
  const firstApproval = approvalInbox.getByRole('row').filter({ hasText: approvalTitle });
  await expect(firstApproval).toBeVisible();
  await firstApproval.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(firstApproval).toHaveCount(0);

  const returnApproval = approvalInbox.getByRole('row').filter({ hasText: returnTitle });
  await expect(returnApproval).toBeVisible();
  await returnApproval.getByRole('button', { name: 'Return' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Return' }).click();
  await expect(returnApproval).toHaveCount(0);
  await logout(page);

  await login(page, maker);
  const returnedRow = page.getByRole('row').filter({ hasText: returnTitle });
  await expect(returnedRow.getByText('RETURNED')).toBeVisible();
  await returnedRow.getByRole('button', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Judul').fill(`${returnTitle} revised`);
  await editDialog.getByRole('button', { name: 'Simpan perubahan' }).click();
  const revisedRow = page.getByRole('row').filter({ hasText: `${returnTitle} revised` });
  await revisedRow.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(revisedRow.getByText('IN REVIEW')).toBeVisible();
  await logout(page);

  await login(page, checker);
  const revisedApproval = page.locator('.ant-card').filter({ has: page.getByRole('heading', { name: 'Approval Inbox' }) })
    .getByRole('row').filter({ hasText: `${returnTitle} revised` });
  await expect(revisedApproval).toBeVisible();
  await revisedApproval.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await logout(page);

  await login(page, admin);
  const finalApproval = page.locator('.ant-card').filter({ has: page.getByRole('heading', { name: 'Approval Inbox' }) })
    .getByRole('row').filter({ hasText: `${returnTitle} revised` });
  await expect(finalApproval).toBeVisible();
  await finalApproval.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();

  const finalRow = page.getByRole('row').filter({ hasText: `${returnTitle} revised` });
  await expect(finalRow.getByText('APPROVED')).toBeVisible();
  await finalRow.getByRole('button').first().click();
  await expect(page.getByText('Riwayat approval')).toBeVisible();
  await expect(page.getByText('APPROVED').last()).toBeVisible();
});
