import { test, expect, Page } from '@playwright/test';

const ALUNO = { cpf: '164.501.020-12', password: 'Senha123!' };
const PRECEPTOR = { cpf: '243.274.740-29', password: 'Senha123!' };

async function login(page: Page, cpf: string, password: string) {
  await page.goto('/login');
  await page.locator('input#cpf').fill(cpf);
  await page.locator('input#password').fill(password);
  await page.locator('button.btn-login').click();
  await page.waitForURL('**/home');
}

async function logout(page: Page) {
  // Sidebar "Sair"
  await page.locator('button:has-text("Sair")').click();
  await page.waitForURL('**/login');
}

test.describe('Check-In/Out completo', () => {
  test('aluno faz check-in com código do preceptor; checkout e filtros', async ({ page, context }) => {
    // Login como preceptor para obter código e id
    await login(page, PRECEPTOR.cpf, PRECEPTOR.password);
    await page.goto('/preceptor/codigo');
    // Aguarda render do código e captura o valor do canvas não é trivial; há também texto do código na tela
    const codeText = page.locator('.code-text');
    await expect(codeText).toBeVisible({ timeout: 15000 });
    const code = (await codeText.textContent())?.trim() || '';
    // Id do preceptor aparece ao lado
    const idText = await page.locator('text=Seu Id é:').locator('xpath=..').textContent();
    const idMatch = idText?.match(/Seu Id é:\s*(\d+)/);
    const preceptorId = idMatch ? Number(idMatch[1]) : NaN;
    expect(code).toBeTruthy();
    expect(preceptorId).toBeGreaterThan(0);

    // Desloga
    await logout(page);

    // Login como aluno
    await login(page, ALUNO.cpf, ALUNO.password);
    await page.goto('/checkin');

    // Preenche e realiza check-in
    await page.getByLabel('ID Preceptor').fill(String(preceptorId));
    await page.getByLabel('Código').fill(code);
    await page.locator('button:has-text("Check-In")').click();
    await expect(page.locator('text=Check-In realizado')).toBeVisible({ timeout: 10000 });

    // Aguarda histórico de hoje ter pelo menos 1 registro (check-in em aberto)
    await expect(page.locator('table tbody tr')).toHaveCount(1, { timeout: 10000 });

    // Abre modal de checkout e confirma
    await page.locator('button:has-text("Realizar Check-Out")').click();
    await expect(page.locator('text=Confirmar Check-Out')).toBeVisible();
    await page.locator('button:has-text("Confirmar")').click();
    await expect(page.locator('text=Check-Out realizado')).toBeVisible({ timeout: 10000 });

    // Usa filtros rápidos do histórico
    await page.locator('button:has-text("Hoje")').click();
    await expect(page.locator('table tbody tr')).toHaveCount(1, { timeout: 10000 });
    await page.locator('button:has-text("3 dias")').click();
    await page.locator('button:has-text("3 semanas")').click();
    await page.locator('button:has-text("Tudo")').click();
    // Apenas validar que tabela continua renderizando sem erro
    await expect(page.locator('table')).toBeVisible();
  });
});
