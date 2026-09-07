SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS erp_citizens (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(32) NULL,
  document_hash CHAR(64) NULL,
  neighborhood VARCHAR(120) NULL,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  tags JSON NULL,
  consent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_erp_citizens_office_name (office_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_demands (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  citizen_id CHAR(36) NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'geral',
  priority ENUM('baixa','normal','alta','urgente') NOT NULL DEFAULT 'normal',
  status ENUM('aberta','triagem','em_andamento','aguardando','resolvida','arquivada') NOT NULL DEFAULT 'aberta',
  assignee_id VARCHAR(64) NULL,
  due_at DATETIME NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_erp_demands_citizen FOREIGN KEY (citizen_id) REFERENCES erp_citizens(id) ON DELETE SET NULL,
  INDEX idx_erp_demands_office_status (office_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_services (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  citizen_id CHAR(36) NULL,
  demand_id CHAR(36) NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'presencial',
  notes TEXT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_erp_services_citizen FOREIGN KEY (citizen_id) REFERENCES erp_citizens(id) ON DELETE SET NULL,
  CONSTRAINT fk_erp_services_demand FOREIGN KEY (demand_id) REFERENCES erp_demands(id) ON DELETE SET NULL,
  INDEX idx_erp_services_office_date (office_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_events (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  location VARCHAR(220) NULL,
  owner_id VARCHAR(64) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'confirmado',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_erp_events_office_start (office_id, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_projects (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'planejamento',
  owner_id VARCHAR(64) NULL,
  budget_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_erp_projects_office_status (office_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_audit (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(64) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_erp_audit_office_date (office_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_communications (
  id CHAR(36) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL,
  title VARCHAR(220) NOT NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'social',
  status ENUM('rascunho','revisao','aprovado','publicado','cancelado') NOT NULL DEFAULT 'rascunho',
  content TEXT NULL,
  scheduled_at DATETIME NULL,
  owner_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_erp_communications_office_status (office_id, status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
