-- Track every tool call the agent makes, linked to tasks when available
CREATE TABLE IF NOT EXISTS agent_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES super_agent_tasks(id) ON DELETE SET NULL,
  conversation_id uuid,
  tool_name text NOT NULL,
  tool_input jsonb DEFAULT '{}'::jsonb,
  tool_output text,
  execution_ms integer,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  member_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_exec_task ON agent_tool_executions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_tool_exec_conv ON agent_tool_executions(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_tool_exec_created ON agent_tool_executions(created_at DESC);
CREATE INDEX idx_tool_exec_tool ON agent_tool_executions(tool_name);

ALTER TABLE agent_tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to agent_tool_executions" ON agent_tool_executions FOR ALL USING (true) WITH CHECK (true);
