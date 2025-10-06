-- ============================================================================
-- MedCheck - Script Único (Criação completa + Seeds)
-- Ambiente: MySQL 8+
-- Objetivo: Ter em UM arquivo toda a criação de tabelas + inserts iniciais
-- ATENÇÃO: Este script é DESTRUTIVO (DROP tables). Use apenas em ambientes de dev/reset.
-- Se estiver usando Spring Boot com spring.jpa.hibernate.ddl-auto=update, considere
-- comentar os DROPs para não conflitar. Este arquivo (schema.sql) roda ANTES do Hibernate.
-- ============================================================================

SET NAMES utf8mb4;
-- Ajuste para fuso horário do Acre (-05:00) durante seeds de desenvolvimento
SET time_zone = '-05:00';
SET foreign_key_checks = 0;
SET unique_checks = 0;

-- Criação explícita do banco (caso esteja executando este script a partir de uma conexão sem database).
CREATE DATABASE IF NOT EXISTS medcheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medcheck;

-- ============================================================================
-- DROPS (limpeza)
-- ============================================================================
DROP TABLE IF EXISTS internship_justifications;
DROP TABLE IF EXISTS internship_plans;
DROP TABLE IF EXISTS preceptor_evaluations;
DROP TABLE IF EXISTS check_codes;
DROP TABLE IF EXISTS check_sessions;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS discipline_preceptors;
DROP TABLE IF EXISTS discipline_coordinators;
DROP TABLE IF EXISTS disciplines;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- TABELA: users
-- ============================================================================
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  birth_date DATE NULL,
  matricula VARCHAR(40) NULL,
  cpf VARCHAR(32) NOT NULL UNIQUE,
  naturalidade VARCHAR(120) NULL,
  nacionalidade VARCHAR(120) NULL,
  phone VARCHAR(40) NULL,
  institutional_email VARCHAR(160) NOT NULL UNIQUE,
  password VARCHAR(120) NOT NULL,
  avatar LONGBLOB NULL,
  avatar_content_type VARCHAR(100) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ALUNO',
  current_discipline_id BIGINT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: password_reset_tokens
-- ============================================================================
CREATE TABLE password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token VARCHAR(100) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX idx_token_unique ON password_reset_tokens(token);

-- ============================================================================
-- TABELA: check_sessions (ciclos de presença)
-- ============================================================================
CREATE TABLE check_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aluno_id BIGINT NOT NULL,
  preceptor_id BIGINT NOT NULL,
  discipline_id BIGINT NULL,
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP NULL,
  -- Localização (opcional) capturada no momento do check-in / check-out
  check_in_lat DECIMAL(10,7) NULL,
  check_in_lng DECIMAL(10,7) NULL,
  check_out_lat DECIMAL(10,7) NULL,
  check_out_lng DECIMAL(10,7) NULL,
  validated BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_cs_aluno FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_preceptor FOREIGN KEY (preceptor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL,
  INDEX idx_cs_aluno_time (aluno_id, check_in_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: check_codes (códigos rotativos por preceptor)
-- ============================================================================
CREATE TABLE check_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  preceptor_id BIGINT NOT NULL,
  code VARCHAR(12) NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  CONSTRAINT fk_cc_preceptor FOREIGN KEY (preceptor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_checkcode_preceptor_time (preceptor_id, generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: internship_plans (planejamento do internato do aluno)
-- ============================================================================
CREATE TABLE internship_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aluno_id BIGINT NOT NULL,
  discipline_id BIGINT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  week_number INT NULL,
  location VARCHAR(160) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_ip_aluno FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ip_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL,
  INDEX idx_ip_user_date (aluno_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: internship_justifications (justificativas do aluno por dia)
-- ============================================================================
CREATE TABLE internship_justifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aluno_id BIGINT NOT NULL,
  plan_id BIGINT NULL,
  discipline_id BIGINT NULL,
  date DATE NOT NULL,
  type VARCHAR(30) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMP NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ij_aluno FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ij_plan FOREIGN KEY (plan_id) REFERENCES internship_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_ij_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ij_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL,
  INDEX idx_ij_user_date (aluno_id, date),
  CONSTRAINT uq_ij_user_date UNIQUE (aluno_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: disciplines
-- ============================================================================
CREATE TABLE disciplines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  hours INT NOT NULL,
  ciclo INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adiciona FK após criação de disciplines (ordem de criação compatível)
ALTER TABLE users
  ADD CONSTRAINT fk_user_current_discipline FOREIGN KEY (current_discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL;

-- ============================================================================
-- RELAÇÃO: discipline_preceptors (muitos-para-muitos)
-- Cada disciplina pode ter vários preceptores e cada preceptor pode estar em várias disciplinas
-- ============================================================================
CREATE TABLE discipline_preceptors (
  discipline_id BIGINT NOT NULL,
  preceptor_id BIGINT NOT NULL,
  PRIMARY KEY (discipline_id, preceptor_id),
  CONSTRAINT fk_dp_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_preceptor FOREIGN KEY (preceptor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relação: discipline_coordinators (muitos-para-muitos)
CREATE TABLE discipline_coordinators (
  discipline_id BIGINT NOT NULL,
  coordinator_id BIGINT NOT NULL,
  PRIMARY KEY (discipline_id, coordinator_id),
  CONSTRAINT fk_dc_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  CONSTRAINT fk_dc_coordinator FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELA: preceptor_evaluations (avaliação semanal do aluno pelo preceptor)
-- Cada registro representa uma avaliação de um aluno em uma semana (1..10) opcionalmente por disciplina.
-- Se discipline_id for NULL, aplica-se ao contexto geral atual do aluno.
-- ============================================================================
CREATE TABLE preceptor_evaluations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aluno_id BIGINT NOT NULL,
  preceptor_id BIGINT NOT NULL,
  discipline_id BIGINT NULL,
  week_number INT NOT NULL,
  score DECIMAL(4,2) NOT NULL,
  comment TEXT NULL,
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pe_aluno FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pe_preceptor FOREIGN KEY (preceptor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pe_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL,
  INDEX idx_pe_lookup (aluno_id, discipline_id, week_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEEDS (Usuários) - Senha: Senha123! (hash Bcrypt abaixo)
-- Hash fixo pode ser trocado; recomende recriar via encoder em produção.
-- ============================================================================
-- Hash usado (Senha123!): $2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C
INSERT INTO users (name,birth_date,matricula,cpf,naturalidade,nacionalidade,phone,institutional_email,password,role) VALUES
 ('Aluno Teste','2000-01-01','202300001','16450102012','Rio Branco','Brasil','68900000001','aluno@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Preceptor Teste','1980-05-10','PRECEPTORMASTER','24327474029','Rio Branco','Brasil','68900000002','preceptor@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','PRECEPTOR'),
 ('Administrador','1985-02-02','ADM001','08284001055','Rio Branco','Brasil','68900000003','admin@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ADMIN'),
 ('Coordenador Teste','1990-03-03','COO001','32247668089','Rio Branco','Brasil','68900000004','coordenador@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','COORDENADOR');

-- Alunos adicionais para testes (>10 no total)
INSERT INTO users (name,birth_date,matricula,cpf,naturalidade,nacionalidade,phone,institutional_email,password,role) VALUES
 ('Aluno Teste 02','2000-02-01','202300002','11111111019','Rio Branco','Brasil','68900000010','aluno02@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 03','2000-03-01','202300003','11111111027','Rio Branco','Brasil','68900000011','aluno03@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 04','2000-04-01','202300004','11111111035','Rio Branco','Brasil','68900000012','aluno04@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 05','2000-05-01','202300005','11111111043','Rio Branco','Brasil','68900000013','aluno05@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 06','2000-06-01','202300006','11111111051','Rio Branco','Brasil','68900000014','aluno06@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 07','2000-07-01','202300007','11111111060','Rio Branco','Brasil','68900000015','aluno07@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 08','2000-08-01','202300008','11111111078','Rio Branco','Brasil','68900000016','aluno08@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 09','2000-09-01','202300009','11111111086','Rio Branco','Brasil','68900000017','aluno09@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 10','2000-10-01','202300010','11111111094','Rio Branco','Brasil','68900000018','aluno10@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 11','2000-11-01','202300011','11111111108','Rio Branco','Brasil','68900000019','aluno11@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 12','2000-12-01','202300012','11111111116','Rio Branco','Brasil','68900000020','aluno12@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 13','2001-01-01','202300013','11111111124','Rio Branco','Brasil','68900000021','aluno13@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 14','2001-02-01','202300014','11111111132','Rio Branco','Brasil','68900000022','aluno14@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 15','2001-03-01','202300015','11111111140','Rio Branco','Brasil','68900000023','aluno15@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Teste 16','2001-04-01','202300016','11111111159','Rio Branco','Brasil','68900000024','aluno16@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO');

-- ============================================================================
-- SEEDS (Sessões históricas) - Exemplo
-- aluno_id = 1 (Aluno Teste), preceptor_id = 2 (Preceptor Teste)
-- ============================================================================
INSERT INTO check_sessions (aluno_id, preceptor_id, check_in_time, check_out_time, validated) VALUES
 (1,2, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 4 HOUR, TRUE),
 (1,2, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 6 HOUR, TRUE),
 (1,2, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 5 HOUR, TRUE);
-- (Exemplo de sessão aberta - descomente para testar estado "ATIVO")
-- INSERT INTO check_sessions (aluno_id, preceptor_id, check_in_time, validated) VALUES (1,2, NOW() - INTERVAL 1 HOUR, TRUE);

-- Vincula os novos alunos à mesma disciplina do preceptor (CCSD463)
SET @disc_clin_med = (SELECT id FROM disciplines WHERE code = 'CCSD463');
INSERT INTO check_sessions (aluno_id, preceptor_id, discipline_id, check_in_time, check_out_time, validated) VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno02@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno03@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 9 DAY, NOW() - INTERVAL 9 DAY + INTERVAL 4 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno04@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 8 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno05@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 7 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno06@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno07@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno08@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno09@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno10@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno11@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 12 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno12@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno13@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY + INTERVAL 4 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno14@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 25 DAY, NOW() - INTERVAL 25 DAY + INTERVAL 6 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno15@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 18 DAY, NOW() - INTERVAL 18 DAY + INTERVAL 5 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno16@teste.com'), 2, @disc_clin_med, NOW() - INTERVAL 1 DAY, NULL, TRUE);

-- ============================================================================
-- SEEDS (Disciplinas)
-- ============================================================================
INSERT INTO disciplines (code, name, hours, ciclo) VALUES
 ('CCSD459','Internato em Medicina de Família e Comunidade',420,1),
 ('CCSD460','Internato em Cirurgia Geral',420,1),
 ('CCSD461','Internato em Ginecologia e Obstetrícia',420,1),
 ('CCSD462','Internato em Pediatria',420,1),
 ('CCSD463','Internato em Clínica Médica',420,1),
 ('CCSD464','Internato Rural em Saúde Coletiva',240,2),
 ('CCSD465','Internato em Geriatria e Gerontologia',240,2),
 ('CCSD466','Internato em Saúde Mental',240,2),
 ('CCSD467','Internato em Medicina Tropical',240,2),
 ('CCSD468','Internato em Urgências e Emergências',240,2);

-- ============================================================================
-- SEEDS (Vínculos Preceptores-Disciplinas)
-- Vincula o Preceptor Teste (id=2) a duas disciplinas para facilitar testes
-- ============================================================================
INSERT INTO discipline_preceptors (discipline_id, preceptor_id)
SELECT d.id, 2 FROM disciplines d WHERE d.code IN ('CCSD459','CCSD463');

-- Vínculo do coordenador de teste (id=4) a algumas disciplinas para testes
INSERT INTO discipline_coordinators (discipline_id, coordinator_id)
SELECT d.id, 4 FROM disciplines d WHERE d.code IN ('CCSD459','CCSD463','CCSD464');

-- ============================================================================
-- - Planos: 08:00-12:00 em todos os dias úteis do mês atual; 14:00-18:00 apenas nos dias pares
-- - Justificativas: PENDING no dia 15; APPROVED no dia 05 do mês atual
-- ============================================================================
-- Geração de datas do mês atual sem CTE (compatível com variações do MySQL 8)
-- Cria uma tabela derivada de números de 0..30 e soma ao primeiro dia do mês atual
-- para obter todas as datas do mês corrente.
-- week_number calculado: ((dia-1) DIV 7) + 1 limitado a 10
INSERT INTO internship_plans (aluno_id, discipline_id, `date`, start_time, end_time, week_number, location, note)
SELECT u.id, NULL, cal.d AS `date`, '08:00', '12:00', LEAST(10, ((DAYOFMONTH(cal.d)-1) DIV 7) + 1) AS week_number, 'UBS Central', 'Plano (seed) manhã'
FROM users u
JOIN (
  SELECT DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL n.n DAY) AS d
  FROM (
    SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
    UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
    UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
    UNION ALL SELECT 30
  ) n
  WHERE n.n <= DAY(LAST_DAY(CURDATE())) - 1
) cal ON DAYOFWEEK(cal.d) BETWEEN 2 AND 6 -- 2=Mon .. 6=Fri
WHERE u.role = 'ALUNO';

-- Inserir planos (tarde) apenas em dias pares (sem CTE)
INSERT INTO internship_plans (aluno_id, discipline_id, `date`, start_time, end_time, week_number, location, note)
SELECT u.id, NULL, cal.d AS `date`, '14:00', '18:00', LEAST(10, ((DAYOFMONTH(cal.d)-1) DIV 7) + 1) AS week_number, 'UBS Central', 'Plano (seed) tarde'
FROM users u
JOIN (
  SELECT DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL n.n DAY) AS d
  FROM (
    SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
    UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
    UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
    UNION ALL SELECT 30
  ) n
  WHERE n.n <= DAY(LAST_DAY(CURDATE())) - 1
) cal ON DAYOFWEEK(cal.d) BETWEEN 2 AND 6 AND MOD(DAYOFMONTH(cal.d), 2) = 0
WHERE u.role = 'ALUNO';

-- Justificativas PENDING no dia 15 (marca ORANGE)
INSERT INTO internship_justifications (aluno_id, `date`, type, reason, status)
SELECT u.id, DATE_FORMAT(CURDATE(), '%Y-%m-15'), 'GENERAL', 'Compromisso pessoal (seed)', 'PENDING'
FROM users u WHERE u.role = 'ALUNO';

-- Justificativas APPROVED no dia 05
INSERT INTO internship_justifications (aluno_id, `date`, type, reason, status, reviewed_by, reviewed_at)
SELECT u.id, DATE_FORMAT(CURDATE(), '%Y-%m-05'), 'HEALTH', 'Atestado médico (seed)', 'APPROVED', 3, NOW()
FROM users u WHERE u.role = 'ALUNO';

SET foreign_key_checks = 1;
SET unique_checks = 1;
-- FIM DO SCRIPT ÚNICO

-- ============================================================================
-- SEEDS ADICIONAIS AVANÇADOS (CENÁRIOS DE TESTE EXPANDIDOS)
-- Objetivo: fornecer diversidade de dados para validar casos de uso do sistema.
-- Todos os usuários usam a mesma senha textual: Senha123!
-- Hash Bcrypt padrão reutilizado: $2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C
-- ============================================================================

-- Evitar duplicação caso script seja executado múltiplas vezes (exemplos usam emails únicos)

-- === Usuários extras (Preceptores, Coordenadores, Admins, Alunos) ===
INSERT INTO users (name,birth_date,matricula,cpf,naturalidade,nacionalidade,phone,institutional_email,password,role) VALUES
 ('Preceptor Clínico 2','1979-01-10','PREC002','55500000011','Rio Branco','Brasil','68910000001','preceptor2@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','PRECEPTOR'),
 ('Preceptor Cirurgia','1975-04-20','PREC003','55500000020','Rio Branco','Brasil','68910000002','preceptor.cir@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','PRECEPTOR'),
 ('Preceptor Pediatria','1982-07-15','PREC004','55500000038','Rio Branco','Brasil','68910000003','preceptor.ped@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','PRECEPTOR'),
 ('Coordenador Clínico','1988-02-12','COO002','55500000046','Rio Branco','Brasil','68910000004','coord.clin@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','COORDENADOR'),
 ('Administrador 2','1986-08-08','ADM002','55500000054','Rio Branco','Brasil','68910000005','admin2@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ADMIN'),
 ('Aluno Antigo 2019','1997-03-03','201900001','55500000062','Rio Branco','Brasil','68910000006','aluno2019@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Antigo 2020','1998-03-03','202000001','55500000070','Rio Branco','Brasil','68910000007','aluno2020@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Turno Noite','2000-06-06','202300099','55500000089','Rio Branco','Brasil','68910000008','aluno.noite@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Aluno Multidisciplina','2000-07-07','202300100','55500000097','Rio Branco','Brasil','68910000009','aluno.multi@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO');

-- === Vínculos extras de preceptores / coordenadores a disciplinas ===
-- Preceptor Clínico 2 (email preceptor2@...) -> Clínica Médica & MFC
INSERT INTO discipline_preceptors (discipline_id, preceptor_id)
SELECT d.id, (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com') FROM disciplines d WHERE d.code IN ('CCSD463','CCSD459');
-- Preceptor Cirurgia -> Cirurgia Geral
INSERT INTO discipline_preceptors (discipline_id, preceptor_id)
SELECT d.id, (SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com') FROM disciplines d WHERE d.code = 'CCSD460';
-- Preceptor Pediatria -> Pediatria
INSERT INTO discipline_preceptors (discipline_id, preceptor_id)
SELECT d.id, (SELECT id FROM users WHERE institutional_email='preceptor.ped@teste.com') FROM disciplines d WHERE d.code = 'CCSD462';
-- Coordenador Clínico coordena Clínica Médica e Urgências
INSERT INTO discipline_coordinators (discipline_id, coordinator_id)
SELECT d.id, (SELECT id FROM users WHERE institutional_email='coord.clin@teste.com') FROM disciplines d WHERE d.code IN ('CCSD463','CCSD468');

-- === Sessões de check-in variadas (datas passadas e atuais) ===
-- Hoje (sessão aberta) para Aluno Turno Noite
INSERT INTO check_sessions (aluno_id, preceptor_id, discipline_id, check_in_time, validated)
VALUES (
 (SELECT id FROM users WHERE institutional_email='aluno.noite@teste.com'),
 (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'),
 (SELECT id FROM disciplines WHERE code='CCSD463'),
 NOW() - INTERVAL 2 HOUR,
 TRUE);

-- Sessões concluídas (últimos dias)
INSERT INTO check_sessions (aluno_id, preceptor_id, discipline_id, check_in_time, check_out_time, validated) VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno.noite@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD463'), NOW() - INTERVAL 1 DAY - INTERVAL 8 HOUR, NOW() - INTERVAL 1 DAY - INTERVAL 2 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), NOW() - INTERVAL 3 DAY - INTERVAL 7 HOUR, NOW() - INTERVAL 3 DAY - INTERVAL 1 HOUR, TRUE),
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor.ped@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD462'), NOW() - INTERVAL 5 DAY - INTERVAL 6 HOUR, NOW() - INTERVAL 5 DAY - INTERVAL 1 HOUR, TRUE);

-- Sessões históricas (anos anteriores) para validar relatórios longos
INSERT INTO check_sessions (aluno_id, preceptor_id, discipline_id, check_in_time, check_out_time, validated, check_in_lat, check_in_lng, check_out_lat, check_out_lng) VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno2019@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD459'), DATE_SUB(NOW(), INTERVAL 5 YEAR) - INTERVAL 10 DAY, DATE_SUB(NOW(), INTERVAL 5 YEAR) - INTERVAL 10 DAY + INTERVAL 5 HOUR, TRUE, -9.9750000,-67.8240000,-9.9745000,-67.8235000),
 ((SELECT id FROM users WHERE institutional_email='aluno2020@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), DATE_SUB(NOW(), INTERVAL 4 YEAR) - INTERVAL 15 DAY, DATE_SUB(NOW(), INTERVAL 4 YEAR) - INTERVAL 15 DAY + INTERVAL 6 HOUR, TRUE, -9.9740000,-67.8250000,-9.9738000,-67.8248000);

-- === Planos de internato específicos (overnight + múltiplos turnos) ===
-- Overnight: início 22:00 fim 02:00 (simula quebra em dois dias via lógica do front)
INSERT INTO internship_plans (aluno_id, discipline_id, `date`, start_time, end_time, week_number, location, note) VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno.noite@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD468'), CURDATE() - INTERVAL 6 DAY, '22:00', '02:00', 1, 'Pronto Socorro', 'Plantão noturno (seed overnight)');

-- Múltiplos turnos no mesmo dia para aluno.multidisciplina (manhã + tarde + noite)
INSERT INTO internship_plans (aluno_id, discipline_id, `date`, start_time, end_time, week_number, location, note) VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE() - INTERVAL 4 DAY, '08:00', '12:00', 1, 'Centro Cirúrgico', 'Cirurgia eletiva'),
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE() - INTERVAL 4 DAY, '14:00', '18:00', 1, 'Centro Cirúrgico', 'Pós-operatório'),
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE() - INTERVAL 4 DAY, '19:00', '23:00', 1, 'Emergência', 'Observação de casos');

-- Planos antigos (ano anterior) para aluno2019 (sem discipline_id => contexto geral)
INSERT INTO internship_plans (aluno_id, discipline_id, `date`, start_time, end_time, week_number, location, note)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno2019@teste.com'), NULL, DATE_SUB(CURDATE(), INTERVAL 400 DAY), '08:00', '12:00', 1, 'UBS Antiga', 'Registro histórico');

-- === Justificativas Diversas ===
-- PENDING (aguardando) hoje
INSERT INTO internship_justifications (aluno_id, discipline_id, `date`, type, reason, status)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE(), 'GENERAL', 'Atraso no transporte', 'PENDING');
-- APPROVED retroativa (ontem)
INSERT INTO internship_justifications (aluno_id, discipline_id, `date`, type, reason, status, reviewed_by, reviewed_at, review_note)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE() - INTERVAL 1 DAY, 'HEALTH', 'Atestado médico', 'APPROVED', (SELECT id FROM users WHERE institutional_email='admin2@teste.com'), NOW(), 'Validado');
-- REJECTED exemplo
INSERT INTO internship_justifications (aluno_id, discipline_id, `date`, type, reason, status, reviewed_by, reviewed_at, review_note)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), CURDATE() - INTERVAL 2 DAY, 'GENERAL', 'Compromisso pessoal', 'REJECTED', (SELECT id FROM users WHERE institutional_email='admin2@teste.com'), NOW(), 'Motivo insuficiente');

-- === Avaliações de Preceptor (várias semanas) ===
-- Semana 1 e 2 com disciplina Clínica Médica
INSERT INTO preceptor_evaluations (aluno_id, preceptor_id, discipline_id, week_number, score, comment, details_json)
VALUES
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), 1, 8.50, 'Boa evolução inicial.', NULL),
 ((SELECT id FROM users WHERE institutional_email='aluno.multi@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD460'), 2, 9.10, 'Melhora nas habilidades cirúrgicas.', '{"dimensions":[{"id":"dim1","answers":{"q1":5,"q2":4}}]}');

-- Avaliação sem disciplina (contexto global) semana 1 para aluno.noite
INSERT INTO preceptor_evaluations (aluno_id, preceptor_id, discipline_id, week_number, score, comment)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno.noite@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'), NULL, 1, 7.75, 'Adaptação ao plantão noturno.');

-- Avaliação histórica (ano anterior) para aluno2019
INSERT INTO preceptor_evaluations (aluno_id, preceptor_id, discipline_id, week_number, score, comment)
VALUES ((SELECT id FROM users WHERE institutional_email='aluno2019@teste.com'), (SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'), (SELECT id FROM disciplines WHERE code='CCSD459'), 1, 9.30, 'Desempenho histórico excelente.');

-- === Check Codes adicionais (validação múltiplos preceptores) ===
INSERT INTO check_codes (preceptor_id, code, generated_at, expires_at, usage_count) VALUES
 ((SELECT id FROM users WHERE institutional_email='preceptor2@teste.com'), 'ABC123', NOW() - INTERVAL 30 MINUTE, NOW() + INTERVAL 30 MINUTE, 2),
 ((SELECT id FROM users WHERE institutional_email='preceptor.cir@teste.com'), 'CIR789', NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 1 HOUR, 0),
 ((SELECT id FROM users WHERE institutional_email='preceptor.ped@teste.com'), 'PED456', NOW() - INTERVAL 10 MINUTE, NOW() + INTERVAL 50 MINUTE, 1);

-- ============================================================================
-- FIM DOS SEEDS ADICIONAIS
-- ============================================================================
