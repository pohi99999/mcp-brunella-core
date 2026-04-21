-- Ágensek tábla
CREATE TABLE IF NOT EXISTS agents (
    agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE, -- pl. 'Brunella', 'Jules'
    role VARCHAR(100) NOT NULL, -- pl. 'Orchestrator', 'DevOps'
    model_config JSONB NOT NULL DEFAULT '{}', -- Hőmérséklet, modell típus
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feladatok tábla
CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_task_id UUID REFERENCES tasks(task_id), -- Rekurzív kapcsolat (Subtask)
    assigned_agent_id UUID REFERENCES agents(agent_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED')),
    priority INTEGER DEFAULT 0,
    input_context JSONB, -- A bemeneti adatok/prompt
    output_result JSONB, -- A végeredmény struktúráltan
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feladat függőségek
CREATE TABLE IF NOT EXISTS task_dependencies (
    predecessor_id UUID REFERENCES tasks(task_id),
    successor_id UUID REFERENCES tasks(task_id),
    dependency_type VARCHAR(20) DEFAULT 'FINISH_TO_START',
    PRIMARY KEY (predecessor_id, successor_id)
);

-- Végrehajtási napló (Gondolatmenet és Tool hívások)
CREATE TABLE IF NOT EXISTS execution_logs (
    log_id BIGSERIAL PRIMARY KEY,
    task_id UUID REFERENCES tasks(task_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    log_type VARCHAR(20) CHECK (log_type IN ('THOUGHT', 'TOOL_CALL', 'TOOL_RESULT', 'ERROR')),
    content TEXT NOT NULL,
    metadata JSONB, -- Pl. tool neve, futási idő
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_task ON execution_logs(task_id);
