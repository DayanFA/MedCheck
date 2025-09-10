import { test, expect, Page } from '@playwright/test';

// Helper CPF/Password used in backend test setup
const TEST_USER = {
  name: 'E2E Usuario',
  cpf: '12345678901',
  cpfMasked: '123.456.789-01',
  email: 'e2e.user@example.com',
  password: 'Senha@123',
  matricula: 'E2E001'
};

async function ensureUser(page: Page) {
  // Try signup silently; if already exists backend will 400 and we ignore
  const resp = await page.request.post('http://localhost:8081/api/auth/signup', {
    data: {
      name: TEST_USER.name,
      birthDate: '2000-01-01',
      matricula: TEST_USER.matricula,
      cpf: TEST_USER.cpf,
      naturalidade: 'SP',
      nacionalidade: 'Brasileira',
      phone: '11999999999',
      institutionalEmail: TEST_USER.email,
      password: TEST_USER.password
    }
  });
  // Ignore 400 duplicate; assert other status codes
  if (resp.status() !== 200 && resp.status() !== 400) {
    throw new Error('Unexpected signup status ' + resp.status() + ' body=' + (await resp.text()));
  }
}

test.describe('Fluxo de Autenticação', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureUser(page);
    await page.close();
  });

  test('Login com CPF mascarado e navegação para /home', async ({ page }) => {
    await page.goto('/login');
    const cpfInput = page.locator('input#cpf');
    await cpfInput.fill(TEST_USER.cpfMasked); // já com máscara
    await page.locator('input#password').fill(TEST_USER.password);
    await page.locator('button.btn-login').click();
    await page.waitForURL('**/home', { timeout: 10000 });
    await expect(page.url()).toContain('/home');
    // Confirma que dados do usuário aparecem (Nome ou CPF)
    await expect(page.locator('text='+TEST_USER.name.split(' ')[0]).first()).toBeVisible({ timeout: 5000 });
  });

  test('Fluxo esqueci senha gera log de link (sem SMTP)', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('input[type=email]').fill(TEST_USER.email);
    await page.locator('button[type=submit]').click();
    // Verifica toast ou mensagem de confirmação
    await expect(page.locator('text=Se o e-mail existir').first()).toBeVisible({ timeout: 5000 });
  });
});
