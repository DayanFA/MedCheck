import { test, expect, Page } from '@playwright/test';

// Test users aligned with backend schema.sql seeds
const ALUNO = { cpf: '164.501.020-12', password: 'Senha123!' };

async function login(page: Page, cpf: string, password: string) {
  await page.goto('/login');
  await page.locator('input#cpf').fill(cpf);
  await page.locator('input#password').fill(password);
  await page.locator('button.btn-login').click();
  await page.waitForURL('**/home');
}

test.describe('Calendário - Plano e Justificativa', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ALUNO.cpf, ALUNO.password);
  await page.goto('/calendar');
    await expect(page.locator('text=Calendário').first()).toBeVisible();
  });

  test('criar/editar/excluir plano; criar/excluir justificativa; selecionar data', async ({ page }) => {
    // Seleciona o primeiro dia do mês via dropdown de data
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = '15'; // meio do mês reduz chance de dia passado com sessões
    const dateIso = `${y}-${m}-${d}`;

    await page.locator('.dropdown >> text=Selecionar data').click();
    const dateInput = page.locator('.dropdown-menu input[type=date]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill(dateIso);
    // pickDate dispara reload se mudar mês/ano e abre o dia

    // Plano: preencher e salvar (Local é obrigatório)
    await page.getByLabel('Início').fill('08:00');
    await page.getByLabel('Fim').fill('12:00');
    await page.getByLabel('Local').fill('Clínica Teste');
    await page.getByLabel('Observação (opcional)').fill('Plano automático e2e');
    await page.locator('button:has-text("Salvar Plano")').click();

    // Verificar que aparece em "Planos do dia" e botão Atualizar funciona
    await expect(page.locator('text=Planos do dia')).toBeVisible();
    // Aguarda render da lista
    await expect(page.locator('.list-group-item:has-text("08:00 - 12:00")')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Atualizar")').click();

    // Justificativa só aparece se houver plano
    await expect(page.locator('text=Justificativa do dia')).toBeVisible();
    // Criar justificativa (deve iniciar como PENDENTE)
    await page.getByLabel('Tipo').selectOption('GENERAL');
    await page.getByLabel('Motivo').fill('Teste de justificativa automática');
    await page.locator('button:has-text("Salvar Justificativa")').click();
    // Depois do save, uma badge PENDENTE deve existir
    await expect(page.locator('.badge:has-text("PENDENTE")')).toBeVisible();

    // Excluir justificativa (PENDENTE)
    // Abre confirm nativo - Playwright automaticamente confirma apenas se page.on('dialog')
    page.once('dialog', d => d.accept());
    await page.locator('button:has-text("Excluir Justificativa")').click();
    // Badge deve sumir
    await expect(page.locator('.badge:has-text("PENDENTE")')).toHaveCount(0);

    // Editar plano criado
    const editBtn = page.locator('.list-group-item:has-text("08:00 - 12:00") button:has-text("Editar")');
    await editBtn.click();
    await page.getByLabel('Fim').fill('13:00');
    await page.locator('button:has-text("Salvar Plano")').click();
    await expect(page.locator('.list-group-item:has-text("08:00 - 13:00")')).toBeVisible({ timeout: 10000 });

    // Excluir plano
    const delBtn = page.locator('.list-group-item:has-text("08:00 - 13:00") button:has-text("Excluir")');
    await delBtn.click();
    // Lista pode ficar vazia
    await expect(page.locator('text=Sem planos.')).toBeVisible();
  });
});
