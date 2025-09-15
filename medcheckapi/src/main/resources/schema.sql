-- ============================================================================
-- MedCheck - Script Único (Criação completa + Seeds)
-- Ambiente: MySQL 8+
-- Objetivo: Ter em UM arquivo toda a criação de tabelas + inserts iniciais
-- ATENÇÃO: Este script é DESTRUTIVO (DROP tables). Use apenas em ambientes de dev/reset.
-- Se estiver usando Spring Boot com spring.jpa.hibernate.ddl-auto=update, considere
-- comentar os DROPs para não conflitar. Este arquivo (schema.sql) roda ANTES do Hibernate.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
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
DROP TABLE IF EXISTS check_codes;
DROP TABLE IF EXISTS check_sessions;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS discipline_preceptors;
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

-- ============================================================================
-- SEEDS (Usuários) - Senha: Senha123! (hash Bcrypt abaixo)
-- Hash fixo pode ser trocado; recomende recriar via encoder em produção.
-- ============================================================================
-- Hash usado (Senha123!): $2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C
INSERT INTO users (name,birth_date,matricula,cpf,naturalidade,nacionalidade,phone,institutional_email,password,role) VALUES
 ('Aluno Teste','2000-01-01','202300001','16450102012','Rio Branco','Brasil','68900000001','aluno@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ALUNO'),
 ('Preceptor Teste','1980-05-10','P0001','24327474029','Rio Branco','Brasil','68900000002','preceptor@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','PRECEPTOR'),
 ('Administrador','1985-02-02','ADM001','08284001055','Rio Branco','Brasil','68900000003','admin@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','ADMIN'),
 ('Coordenador Teste','1990-03-03','COO001','32247668089','Rio Branco','Brasil','68900000004','coordenador@teste.com','$2a$10$nTAo/it/5z.s3kEBe3765.ZC3kjWnPluNs3Mfe3LaKfdZIqyCxc.C','COORDENADOR');

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

SET foreign_key_checks = 1;
SET unique_checks = 1;
-- FIM DO SCRIPT ÚNICO
