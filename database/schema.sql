-- Harbinger Agent Memory System Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: tasks
-- Stores task execution history
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    input TEXT NOT NULL,
    plan JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'planned',
    results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- ============================================
-- Table: user_aliases
-- Stores flexible user aliases and mappings
-- ============================================
CREATE TABLE IF NOT EXISTS user_aliases (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) NOT NULL,
    alias_value VARCHAR(500) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (alias_type, alias_value)
);

CREATE INDEX IF NOT EXISTS idx_user_aliases_user_id ON user_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aliases_alias_type ON user_aliases(alias_type);
CREATE INDEX IF NOT EXISTS idx_user_aliases_alias_value ON user_aliases(alias_value);

-- ============================================
-- Table: agent_memory
-- Generic key-value memory store
-- ============================================
CREATE TABLE IF NOT EXISTS agent_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    memory_key VARCHAR(255) NOT NULL,
    memory_value JSONB NOT NULL,
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user_id ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_memory_key ON agent_memory(memory_key);

-- ============================================
-- Trigger: Update updated_at on agent_memory
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_memory_updated_at 
    BEFORE UPDATE ON agent_memory 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE tasks IS 'Stores task execution history from orchestrator';
COMMENT ON TABLE user_aliases IS 'Flexible alias system: email, name, location, preference, etc.';
COMMENT ON TABLE agent_memory IS 'Generic key-value memory for agent context';

COMMENT ON COLUMN user_aliases.alias_type IS 'Type: email, name, nickname, location, preference, contact, identifier, custom';
COMMENT ON COLUMN user_aliases.metadata IS 'Additional structured data (e.g., coordinates for locations)';
