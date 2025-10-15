# Deploy no Render (API + Web + MySQL)

Este repositório já está preparado para deploy 100% no Render usando `render.yaml`.

## O que está incluído
- `render.yaml`: define 3 serviços no Render
  - `mysql`: serviço privado MySQL 8 com volume persistente
  - `medcheck-api`: Spring Boot (Java 17), build Maven e start com variáveis de ambiente
  - `medcheck-web`: Angular SSR (Node 20) com proxy `/api` para a API
- Dockerfiles: `medcheckapi/Dockerfile` e `medcheckapp/Dockerfile`
- CORS dinâmico na API via env `FRONTEND_ORIGINS`

## Passos
1. Faça push para seu repositório GitHub.
2. No painel do Render, clique em "New +" → "Blueprint" e selecione seu repositório.
3. Confirme a detecção do `render.yaml` e crie os serviços.
4. Render provisiona o MySQL e cria os apps `medcheck-api` e `medcheck-web`.
5. Após o deploy:
   - Configure DNS do seu domínio para o `medcheck-web` (opcional) e ative HTTPS.

## Variáveis importantes
- `APP_JWT_SECRET` (gerada automaticamente no Render pelo blueprint)
- `APP_RESET_BASE_URL` (já apontada para a URL do `medcheck-web` via blueprint)
- `FRONTEND_ORIGINS` (origens permitidas no CORS da API; ex.: `https://seu-dominio.com`)
- Credenciais MySQL no `mysql` (já definidas no blueprint). A API se conecta em `mysql:3306` dentro da rede Render.

## Seeds/Schema
Em produção, o `schema.sql` NÃO roda automaticamente (`spring.sql.init.mode=never`). Garanta que seu banco esteja provisionado. Se precisar rodar seeds uma vez, execute manualmente via cliente MySQL.

## Build local (opcional)
- API: `cd medcheckapi && ./mvnw -DskipTests package`
- Web: `cd medcheckapp && npm ci && npm run build && npm run serve:ssr:medcheckapp`

## Suporte
Se desejar ajustar planos, autoscaling, ou logs, faça no painel do Render.
