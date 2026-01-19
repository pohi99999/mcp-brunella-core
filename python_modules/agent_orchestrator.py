#!/usr/bin/env python3
"""
Agent Orchestrator - Intelligent Task Delegation

This module orchestrates task delegation to various AI agents:
- Gemini CLI: Code generation, review, refactoring
- Claude Code: Complex coding, architecture design
- Jules: Automation, batch processing, workflows

It collects feedback and selects agents based on priority and capabilities.
"""

import json
import subprocess
import sys
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path


class AgentOrchestrator:
    """Orchestrates task delegation to AI agents"""
    
    def __init__(self):
        """Initialize the agent orchestrator"""
        self.agents = {
            'gemini': {
                'name': 'Gemini CLI',
                'command': 'gemini',
                'capabilities': ['code_generation', 'code_review', 'refactoring', 'documentation'],
                'priority': 1,
                'timeout': 300  # 5 minutes
            },
            'claude': {
                'name': 'Claude Code',
                'command': 'claude',
                'capabilities': ['complex_coding', 'architecture', 'debugging', 'optimization'],
                'priority': 2,
                'timeout': 300
            },
            'jules': {
                'name': 'Jules CLI',
                'command': 'jules',
                'capabilities': ['automation', 'batch_processing', 'workflow', 'scripting'],
                'priority': 3,
                'timeout': 600  # 10 minutes for longer workflows
            }
        }
        self.feedback_log = []
    
    def select_agent(self, task_type: str, requirements: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Select the best agent for a given task type
        
        Args:
            task_type: Type of task (e.g., 'code_generation', 'automation')
            requirements: Additional requirements for agent selection
        
        Returns:
            Agent identifier or None if no suitable agent found
        """
        if requirements is None:
            requirements = {}
        
        # Find agents that can handle this task type
        capable_agents = []
        for agent_id, agent in self.agents.items():
            if task_type in agent['capabilities']:
                capable_agents.append((agent_id, agent['priority']))
        
        if not capable_agents:
            return None
        
        # Sort by priority (lower number = higher priority)
        capable_agents.sort(key=lambda x: x[1])
        
        # Return highest priority agent
        return capable_agents[0][0]
    
    def delegate_task(
        self, 
        task_type: str, 
        task_description: str,
        context: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delegate a task to an appropriate agent
        
        Args:
            task_type: Type of task
            task_description: Detailed description of the task
            context: Additional context (files, code, etc.)
            agent_id: Specific agent to use (or auto-select if None)
        
        Returns:
            Dict with result, feedback, and metadata
        """
        if context is None:
            context = {}
        
        # Select agent if not specified
        if agent_id is None:
            agent_id = self.select_agent(task_type)
        
        if agent_id is None or agent_id not in self.agents:
            return {
                'success': False,
                'error': f"No suitable agent found for task type: {task_type}",
                'timestamp': datetime.now().isoformat()
            }
        
        agent = self.agents[agent_id]
        
        # Prepare task payload
        task_payload = {
            'type': task_type,
            'description': task_description,
            'context': context,
            'timestamp': datetime.now().isoformat()
        }
        
        # Execute agent (simulated - in production this would call actual agents)
        result = self._execute_agent(agent_id, agent, task_payload)
        
        # Log feedback
        self._log_feedback(agent_id, task_type, result)
        
        return result
    
    def _execute_agent(
        self, 
        agent_id: str, 
        agent: Dict[str, Any], 
        task_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute an agent with the given task
        
        Args:
            agent_id: Agent identifier
            agent: Agent configuration
            task_payload: Task details
        
        Returns:
            Execution result
        """
        # In production, this would actually call the agent CLI
        # For now, we return a simulated response
        
        # SECURITY NOTE: When implementing actual subprocess execution,
        # ensure proper input validation and sanitization:
        # - Validate command paths
        # - Sanitize arguments to prevent command injection
        # - Use timeout to prevent hanging processes
        # - Capture and validate output
        
        try:
            # Simulate agent execution
            # In real implementation:
            # result = subprocess.run(
            #     [agent['command'], '--task', json.dumps(task_payload)],
            #     capture_output=True,
            #     timeout=agent['timeout'],
            #     text=True
            # )
            
            return {
                'success': True,
                'agent_id': agent_id,
                'agent_name': agent['name'],
                'task_type': task_payload['type'],
                'result': f"Task delegated to {agent['name']}",
                'feedback': {
                    'status': 'completed',
                    'quality': 'good',
                    'execution_time': 0.0
                },
                'timestamp': datetime.now().isoformat()
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'agent_id': agent_id,
                'error': f"Agent {agent['name']} timed out",
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'agent_id': agent_id,
                'error': f"Agent {agent['name']} failed: {str(e)}",
                'timestamp': datetime.now().isoformat()
            }
    
    def _log_feedback(self, agent_id: str, task_type: str, result: Dict[str, Any]):
        """Log feedback from agent execution"""
        feedback_entry = {
            'agent_id': agent_id,
            'task_type': task_type,
            'success': result.get('success', False),
            'timestamp': result.get('timestamp'),
            'feedback': result.get('feedback')
        }
        
        self.feedback_log.append(feedback_entry)
    
    def get_feedback_summary(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get summary of agent feedback
        
        Args:
            agent_id: Optional agent ID to filter feedback
        
        Returns:
            Summary statistics
        """
        relevant_feedback = self.feedback_log
        if agent_id:
            relevant_feedback = [f for f in self.feedback_log if f['agent_id'] == agent_id]
        
        if not relevant_feedback:
            return {
                'total_tasks': 0,
                'success_rate': 0.0,
                'agents': {}
            }
        
        total = len(relevant_feedback)
        successful = sum(1 for f in relevant_feedback if f['success'])
        
        # Per-agent statistics
        agent_stats = {}
        for entry in relevant_feedback:
            aid = entry['agent_id']
            if aid not in agent_stats:
                agent_stats[aid] = {'total': 0, 'successful': 0}
            
            agent_stats[aid]['total'] += 1
            if entry['success']:
                agent_stats[aid]['successful'] += 1
        
        return {
            'total_tasks': total,
            'successful_tasks': successful,
            'success_rate': successful / total if total > 0 else 0.0,
            'agents': agent_stats
        }
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all available agents with their capabilities"""
        result = []
        for agent_id, agent in self.agents.items():
            result.append({
                'id': agent_id,
                'name': agent['name'],
                'capabilities': agent['capabilities'],
                'priority': agent['priority']
            })
        
        return sorted(result, key=lambda x: x['priority'])


def main():
    """Command-line interface for agent orchestrator"""
    if len(sys.argv) < 3:
        print("Usage: python agent_orchestrator.py <command> <args>")
        print("\nCommands:")
        print("  list                           - List all available agents")
        print("  select <task_type>             - Select best agent for task type")
        print("  delegate <task_type> <desc>    - Delegate task to appropriate agent")
        print("  feedback [agent_id]            - Get feedback summary")
        print("\nExamples:")
        print("  python agent_orchestrator.py list")
        print("  python agent_orchestrator.py select code_generation")
        print("  python agent_orchestrator.py delegate automation 'Create backup script'")
        sys.exit(1)
    
    command = sys.argv[1]
    orchestrator = AgentOrchestrator()
    
    if command == 'list':
        agents = orchestrator.list_agents()
        print(json.dumps(agents, indent=2))
    
    elif command == 'select':
        if len(sys.argv) < 3:
            print("Error: task_type required for select command")
            sys.exit(1)
        
        task_type = sys.argv[2]
        agent_id = orchestrator.select_agent(task_type)
        
        if agent_id:
            print(json.dumps({
                'agent_id': agent_id,
                'agent_name': orchestrator.agents[agent_id]['name'],
                'task_type': task_type
            }, indent=2))
        else:
            print(json.dumps({
                'error': f"No agent found for task type: {task_type}"
            }, indent=2))
    
    elif command == 'delegate':
        if len(sys.argv) < 4:
            print("Error: task_type and description required for delegate command")
            sys.exit(1)
        
        task_type = sys.argv[2]
        task_description = sys.argv[3]
        
        result = orchestrator.delegate_task(task_type, task_description)
        print(json.dumps(result, indent=2))
    
    elif command == 'feedback':
        agent_id = sys.argv[2] if len(sys.argv) > 2 else None
        summary = orchestrator.get_feedback_summary(agent_id)
        print(json.dumps(summary, indent=2))
    
    else:
        print(f"Error: Unknown command '{command}'")
        sys.exit(1)


if __name__ == '__main__':
    main()
