#!/usr/bin/env python3
"""
Query Router - Intelligent Tool Selection

This module routes tasks to the appropriate tools based on:
- Task type and requirements
- System state (CPU, memory, I/O)
- Tool availability and priority
"""

import json
import os
import sys
from typing import Dict, List, Optional, Any
from pathlib import Path


class QueryRouter:
    """Routes queries to appropriate tools based on task and system state"""
    
    def __init__(self, registry_path: str = "tools_registry.json"):
        """Initialize the query router with tool registry"""
        self.registry_path = registry_path
        self.tools = {}
        self.task_categories = {}
        self.load_registry()
    
    def load_registry(self):
        """Load tools registry from JSON file"""
        try:
            registry_file = Path(self.registry_path)
            if not registry_file.exists():
                # Try relative to script location
                script_dir = Path(__file__).parent.parent
                registry_file = script_dir / self.registry_path
            
            with open(registry_file, 'r', encoding='utf-8') as f:
                registry = json.load(f)
                self.tools = registry.get('tools', {})
                self.task_categories = registry.get('task_categories', {})
            
            print(f"✓ Loaded {len(self.tools)} tools from registry", file=sys.stderr)
        except Exception as e:
            print(f"✗ Error loading registry: {e}", file=sys.stderr)
            self.tools = {}
            self.task_categories = {}
    
    def route_task(self, task: str, system_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Route a task to the appropriate tool
        
        Args:
            task: Task identifier (e.g., "optimize_cpu", "check_disk_health")
            system_state: Current system state with metrics
        
        Returns:
            Dict with tool name, command, and reasoning
        """
        if system_state is None:
            system_state = {}
        
        # Check if task matches a category
        if task in self.task_categories:
            category = self.task_categories[task]
            preferred_tools = category.get('preferred_tools', [])
            priority = category.get('priority', 'medium')
            
            # Find first available tool
            for tool_name in preferred_tools:
                if tool_name in self.tools:
                    tool = self.tools[tool_name]
                    return {
                        'tool_name': tool_name,
                        'tool_path': tool.get('path'),
                        'description': tool.get('description'),
                        'actions': tool.get('actions', []),
                        'priority': priority,
                        'reasoning': f"Task '{task}' matches category, using preferred tool '{tool_name}'"
                    }
        
        # Check system state triggers
        if system_state:
            triggered_tools = self._check_triggers(system_state)
            if triggered_tools:
                tool_name = triggered_tools[0]
                tool = self.tools[tool_name]
                return {
                    'tool_name': tool_name,
                    'tool_path': tool.get('path'),
                    'description': tool.get('description'),
                    'actions': tool.get('actions', []),
                    'priority': 'high',
                    'reasoning': f"System state triggered tool '{tool_name}'"
                }
        
        # Fuzzy matching based on task description
        matched_tool = self._fuzzy_match(task)
        if matched_tool:
            tool_name, tool = matched_tool
            return {
                'tool_name': tool_name,
                'tool_path': tool.get('path'),
                'description': tool.get('description'),
                'actions': tool.get('actions', []),
                'priority': 'medium',
                'reasoning': f"Fuzzy matched task to tool '{tool_name}'"
            }
        
        return {
            'tool_name': None,
            'error': f"No suitable tool found for task: {task}",
            'reasoning': 'No matching tool or trigger'
        }
    
    def _check_triggers(self, system_state: Dict[str, Any]) -> List[str]:
        """Check which tools should be triggered based on system state"""
        triggered = []
        
        cpu_load = system_state.get('cpu_load', 0)
        memory_usage = system_state.get('memory_usage', 0)
        io_latency = system_state.get('io_latency', 0)
        llm_active = system_state.get('llm_active', False)
        
        for tool_name, tool in self.tools.items():
            trigger = tool.get('trigger', {})
            trigger_type = trigger.get('type')
            
            if trigger_type == 'threshold':
                # Check CPU threshold
                if 'cpu_threshold' in trigger:
                    requires_llm = trigger.get('requires_llm_active', False)
                    if cpu_load > trigger['cpu_threshold']:
                        if not requires_llm or llm_active:
                            triggered.append(tool_name)
                
                # Check I/O latency threshold
                if 'io_latency_threshold_ms' in trigger:
                    if io_latency > trigger['io_latency_threshold_ms']:
                        triggered.append(tool_name)
        
        return triggered
    
    def _fuzzy_match(self, task: str) -> Optional[tuple]:
        """Fuzzy match task to tool based on description and usage"""
        task_lower = task.lower()
        best_match = None
        best_score = 0
        
        keywords_map = {
            'cpu': ['ProcessLasso'],
            'optimize': ['ProcessLasso'],
            'disk': ['CrystalDiskInfo'],
            'ssd': ['CrystalDiskInfo'],
            'hardware': ['HWiNFO'],
            'monitor': ['HWiNFO', 'TaskManager'],
            'temperature': ['HWiNFO'],
            'code': ['GeminiCLI', 'ClaudeCode'],
            'generate': ['GeminiCLI'],
            'review': ['GeminiCLI', 'ClaudeCode'],
            'automate': ['Jules'],
            'workflow': ['Jules']
        }
        
        for keyword, tool_names in keywords_map.items():
            if keyword in task_lower:
                for tool_name in tool_names:
                    if tool_name in self.tools:
                        return (tool_name, self.tools[tool_name])
        
        return None
    
    def launch(self, tool_name: str, action: str = 'default') -> Dict[str, Any]:
        """
        Launch a tool with specified action
        
        Args:
            tool_name: Name of the tool to launch
            action: Action to perform (default uses first action)
        
        Returns:
            Dict with launch status and command
        """
        if tool_name not in self.tools:
            return {
                'success': False,
                'error': f"Tool '{tool_name}' not found in registry"
            }
        
        tool = self.tools[tool_name]
        actions = tool.get('actions', [])
        
        if not actions:
            return {
                'success': False,
                'error': f"No actions defined for tool '{tool_name}'"
            }
        
        # Find requested action or use first one
        selected_action = actions[0]
        if action != 'default':
            for act in actions:
                if act.get('name') == action:
                    selected_action = act
                    break
        
        command = selected_action.get('command')
        args = selected_action.get('args', [])
        
        return {
            'success': True,
            'tool_name': tool_name,
            'action': selected_action.get('name'),
            'command': command,
            'args': args,
            'full_command': f"{command} {' '.join(args)}" if args else command
        }
    
    def list_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all available tools, optionally filtered by category"""
        result = []
        
        for tool_name, tool in self.tools.items():
            if category and tool.get('category') != category:
                continue
            
            result.append({
                'name': tool_name,
                'description': tool.get('description'),
                'category': tool.get('category'),
                'platform': tool.get('platform'),
                'usage': tool.get('usage')
            })
        
        return result


def main():
    """Command-line interface for query router"""
    if len(sys.argv) < 2:
        print("Usage: python query_router.py <task> [--cpu=<load>] [--memory=<usage>] [--io=<latency>] [--llm-active]")
        print("\nExamples:")
        print("  python query_router.py optimize_cpu --cpu=85 --llm-active")
        print("  python query_router.py check_disk_health --io=150")
        print("  python query_router.py code_generation")
        sys.exit(1)
    
    task = sys.argv[1]
    
    # Parse system state from arguments
    system_state = {}
    for arg in sys.argv[2:]:
        if arg.startswith('--cpu='):
            system_state['cpu_load'] = float(arg.split('=')[1])
        elif arg.startswith('--memory='):
            system_state['memory_usage'] = float(arg.split('=')[1])
        elif arg.startswith('--io='):
            system_state['io_latency'] = float(arg.split('=')[1])
        elif arg == '--llm-active':
            system_state['llm_active'] = True
    
    # Route the task
    router = QueryRouter()
    result = router.route_task(task, system_state)
    
    # Print result as JSON
    print(json.dumps(result, indent=2))
    
    # If tool found, show launch command
    if result.get('tool_name'):
        launch_result = router.launch(result['tool_name'])
        print("\nLaunch command:", file=sys.stderr)
        print(f"  {launch_result.get('full_command')}", file=sys.stderr)


if __name__ == '__main__':
    main()
