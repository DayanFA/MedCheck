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
DROP TABLE IF EXISTS check_codes;
DROP TABLE IF EXISTS check_sessions;
DROP TABLE IF EXISTS password_reset_tokens;
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
  role VARCHAR(20) NOT NULL DEFAULT 'ALUNO'
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
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP NULL,
  validated BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_cs_aluno FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_preceptor FOREIGN KEY (preceptor_id) REFERENCES users(id) ON DELETE CASCADE,
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

SET foreign_key_checks = 1;
SET unique_checks = 1;
-- FIM DO SCRIPT ÚNICO
