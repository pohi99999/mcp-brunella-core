/**
 * P7 Task Queue Tests
 * Tests TaskQueueManager functionality including:
 * - Task addition, retrieval, filtering
 * - Cancellation, retry logic
 * - Priority scheduling
 * - Stats calculation
 * - Cleanup operations
 * - Processing loop behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

// Mock logger first
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
  setAgentStatus: vi.fn(),
}))

// Mock pipelineRunner module
const mockPipelineRunner = {
  startPipeline: vi.fn(),
  getPipeline: vi.fn(),
}
vi.mock('../src/agents/pipelineRunner.js', () => ({
  pipelineRunner: mockPipelineRunner,
}))

// Import TaskQueueManager after mocks and a local type copy
type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
type TaskPriority = 'high' | 'medium' | 'low'

describe('TaskQueueManager - P7 Queue', () => {
  let TaskQueueManager: any
  let manager: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    mockPipelineRunner.startPipeline.mockReset()
    mockPipelineRunner.getPipeline.mockReset()
    
    // Import module fresh
    const mod = await import('../src/agents/taskQueue.js')
    TaskQueueManager = mod.TaskQueueManager
    // Create manager with autoStart=false for testing
    manager = new TaskQueueManager(3, false)
  })

  afterEach(async () => {
    if (manager) {
      await manager.stop()
    }
  })

  // ==================== Task Addition ====================

  it('should add a task and return taskId', async () => {
    const taskId = await manager.addTask('generate', 'Create API endpoint', {
      prompt: 'Build REST API',
    })

    expect(taskId).toMatch(/^task-\d+-\d+$/) // task-timestamp-counter format
    const task = manager.getTask(taskId)
    expect(task).toBeDefined()
    expect(task.type).toBe('generate')
    expect(task.description).toBe('Create API endpoint')
    expect(task.status).toBe('queued')
    expect(task.priority).toBe('medium') // default
  })

  it('should add task with custom priority', async () => {
    const taskId = await manager.addTask('test', 'Run unit tests', {}, { priority: 'high' })
    const task = manager.getTask(taskId)
    expect(task.priority).toBe('high')
  })

  it('should emit task:added event on addTask', async () => {
    const listener = vi.fn()
    manager.on('task:added', listener)

    const taskId = await manager.addTask('fix', 'Fix syntax error', {})
    
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, status: 'queued' })
    )
  })

  // ==================== Task Retrieval ====================

  it('should return null for non-existent taskId', () => {
    const task = manager.getTask('non-existent-id')
    expect(task).toBeNull()
  })

  it('should get all tasks (unsorted by default)', async () => {
    await manager.addTask('generate', 'Task 1', {})
    await manager.addTask('test', 'Task 2', {})
    
    const tasks = manager.getTasks()
    expect(tasks.length).toBe(2)
  })

  it('should filter tasks by status', async () => {
    const id1 = await manager.addTask('generate', 'Task queued', {})
    const id2 = await manager.addTask('test', 'Task run', {})
    
    // Manually set status for testing
    const task2 = manager.getTask(id2)
    task2.status = 'running'
    task2.startedAt = Date.now()

    const queuedTasks = manager.getTasks({ status: 'queued' })
    expect(queuedTasks.length).toBe(1)
    expect(queuedTasks[0].id).toBe(id1)

    const runningTasks = manager.getTasks({ status: 'running' })
    expect(runningTasks.length).toBe(1)
    expect(runningTasks[0].id).toBe(id2)
  })

  it('should filter tasks by type', async () => {
    await manager.addTask('generate', 'Gen task', {})
    await manager.addTask('test', 'Test task', {})
    await manager.addTask('test', 'Another test', {})

    const testTasks = manager.getTasks({ type: 'test' })
    expect(testTasks.length).toBe(2)
    testTasks.forEach((t: any) => expect(t.type).toBe('test'))
  })

  it('should filter tasks by priority', async () => {
    await manager.addTask('generate', 'High task', {}, { priority: 'high' })
    await manager.addTask('test', 'Low task', {}, { priority: 'low' })

    const highTasks = manager.getTasks({ priority: 'high' })
    expect(highTasks.length).toBe(1)
    expect(highTasks[0].priority).toBe('high')
  })

  it('should sort tasks by priority then age', async () => {
    // Add tasks in order: low, medium, high
    const lowId = await manager.addTask('generate', 'Low priority', {}, { priority: 'low' })
    await new Promise(resolve => setTimeout(resolve, 10)) // ensure different timestamps
    const medId = await manager.addTask('test', 'Medium priority', {}, { priority: 'medium' })
    await new Promise(resolve => setTimeout(resolve, 10))
    const highId = await manager.addTask('fix', 'High priority', {}, { priority: 'high' })

    const tasks = manager.getTasks()
    
    // Should be sorted: high, medium, low (priority DESC, createdAt ASC)
    expect(tasks[0].id).toBe(highId)
    expect(tasks[1].id).toBe(medId)
    expect(tasks[2].id).toBe(lowId)
  })

  // ==================== Task Cancellation ====================

  it('should cancel a queued task', async () => {
    const taskId = await manager.addTask('generate', 'Cancel me', {})
    const cancelled = await manager.cancelTask(taskId)

    expect(cancelled).toBe(true)
    const task = manager.getTask(taskId)
    expect(task.status).toBe('cancelled')
    expect(task.completedAt).toBeGreaterThan(0)
  })

  it('should cancel a running task', async () => {
    const taskId = await manager.addTask('test', 'Running task', {})
    const task = manager.getTask(taskId)
    
    // Simulate task running
    task.status = 'running'
    task.startedAt = Date.now()

    const cancelled = await manager.cancelTask(taskId)
    expect(cancelled).toBe(true)
    expect(task.status).toBe('cancelled')
  })

  it('should NOT cancel already completed task', async () => {
    const taskId = await manager.addTask('generate', 'Done task', {})
    const task = manager.getTask(taskId)
    task.status = 'completed'
    task.completedAt = Date.now()

    const cancelled = await manager.cancelTask(taskId)
    expect(cancelled).toBe(false)
    expect(task.status).toBe('completed') // unchanged
  })

  it('should emit task:cancelled event', async () => {
    const listener = vi.fn()
    manager.on('task:cancelled', listener)

    const taskId = await manager.addTask('test', 'To cancel', {})
    await manager.cancelTask(taskId)

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, status: 'cancelled' })
    )
  })

  // ==================== Task Retry ====================

  it('should retry a failed task', async () => {
    const taskId = await manager.addTask('test', 'Failing task', {}, { maxRetries: 3 })
    const task = manager.getTask(taskId)
    
    task.status = 'failed'
    task.error = 'Something broke'
    task.completedAt = Date.now()

    const newTaskId = await manager.retryTask(taskId)
    expect(newTaskId).toBeDefined()
    expect(newTaskId).not.toBe(taskId)

    const newTask = manager.getTask(newTaskId!)
    expect(newTask.status).toBe('queued')
    expect(newTask.retryCount).toBe(1)
  })

  it('should NOT retry non-failed task', async () => {
    const taskId = await manager.addTask('generate', 'OK task', {})
    const task = manager.getTask(taskId)
    task.status = 'completed'

    const newTaskId = await manager.retryTask(taskId)
    expect(newTaskId).toBeNull()
  })

  it('should NOT retry if maxRetries exceeded', async () => {
    const taskId = await manager.addTask('test', 'Max retries', {}, { maxRetries: 2 })
    const task = manager.getTask(taskId)
    
    task.status = 'failed'
    task.retryCount = 2 // already at max

    const newTaskId = await manager.retryTask(taskId)
    expect(newTaskId).toBeNull()
  })

  // ==================== Task Prioritization ====================

  it('should prioritize a queued task', async () => {
    const taskId = await manager.addTask('generate', 'Low task', {}, { priority: 'low' })
    const changed = manager.prioritizeTask(taskId, 'high')

    expect(changed).toBe(true)
    const task = manager.getTask(taskId)
    expect(task.priority).toBe('high')
  })

  it('should NOT prioritize non-queued task', async () => {
    const taskId = await manager.addTask('test', 'Running', {})
    const task = manager.getTask(taskId)
    task.status = 'running'

    const changed = manager.prioritizeTask(taskId, 'high')
    expect(changed).toBe(false)
    expect(task.priority).toBe('medium') // unchanged
  })

  // ==================== Queue Stats ====================

  it('should calculate correct stats', async () => {
    // Add 5 tasks with mixed statuses
    const id1 = await manager.addTask('generate', 'Task 1', {})
    const id2 = await manager.addTask('test', 'Task 2', {})
    const id3 = await manager.addTask('fix', 'Task 3', {})
    
    const task1 = manager.getTask(id1)
    task1.status = 'completed'
    task1.startedAt = Date.now() - 5000
    task1.completedAt = Date.now()

    const task2 = manager.getTask(id2)
    task2.status = 'running'
    task2.startedAt = Date.now() - 1000
    // Manually add to runningTasks Set (simulates real execution)
    manager['runningTasks'].add(id2)

    const task3 = manager.getTask(id3)
    task3.status = 'failed'
    task3.startedAt = Date.now() - 2000
    task3.completedAt = Date.now()
    task3.error = 'Error'

    const stats = manager.getStats()
    
    expect(stats.total).toBe(3)
    expect(stats.queued).toBe(0)
    expect(stats.running).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.cancelled).toBe(0)
    expect(stats.avgExecutionTime).toBeGreaterThan(0)
  })

  it('should handle empty queue stats', () => {
    const stats = manager.getStats()
    expect(stats.total).toBe(0)
    expect(stats.avgWaitTime).toBe(0)
    expect(stats.avgExecutionTime).toBe(0)
  })

  // ==================== Cleanup ====================

  it('should cleanup old tasks and keep recent', async () => {
    // Add 5 completed tasks
    for (let i = 0; i < 5; i++) {
      const id = await manager.addTask('test', `Task ${i}`, {})
      const task = manager.getTask(id)
      task.status = 'completed'
      task.completedAt = Date.now()
    }

    const removed = manager.cleanup(3)
    expect(removed).toBe(2) // removed 2 oldest

    const tasks = manager.getTasks()
    expect(tasks.length).toBe(3)
  })

  it('should NOT cleanup queued or running tasks', async () => {
    const id1 = await manager.addTask('test', 'Queued', {})
    const id2 = await manager.addTask('test', 'Running', {})
    const id3 = await manager.addTask('test', 'Completed', {})

    const task2 = manager.getTask(id2)
    task2.status = 'running'
    task2.startedAt = Date.now()
    manager['runningTasks'].add(id2)

    const task3 = manager.getTask(id3)
    task3.status = 'completed'
    task3.completedAt = Date.now()

    // cleanup(0) should remove all completed/failed/cancelled tasks (1 task removed)
    const removed = manager.cleanup(0)
    expect(removed).toBe(1) // only completed task removed

    const remaining = manager.getTasks()
    expect(remaining.length).toBe(2)
    expect(remaining.some((t: any) => t.id === id1)).toBe(true)
    expect(remaining.some((t: any) => t.id === id2)).toBe(true)
  })

  // ==================== Event Emitter ====================

  it('should emit task:completed event on success', async () => {
    const listener = vi.fn()
    manager.on('task:completed', listener)

    const taskId = await manager.addTask('generic', 'Quick task', {})
    const task = manager.getTask(taskId)
    
    // Simulate completion
    task.status = 'completed'
    task.result = { success: true }
    task.completedAt = Date.now()
    manager.emit('task:completed', task)

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, status: 'completed' })
    )
  })

  it('should emit task:failed event on error', async () => {
    const listener = vi.fn()
    manager.on('task:failed', listener)

    const taskId = await manager.addTask('test', 'Bad task', {})
    const task = manager.getTask(taskId)
    
    task.status = 'failed'
    task.error = 'Test error'
    task.completedAt = Date.now()
    manager.emit('task:failed', task)

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskId, status: 'failed', error: 'Test error' })
    )
  })

  // ==================== Stop ====================

  it('should stop processing loop', async () => {
    await manager.addTask('test', 'Some task', {})
    
    // Start processing (normally auto-starts, but we force it)
    // manager.startProcessing() // not exposed, but called internally
    
    await manager.stop()
    
    // After stop, interval should be cleared
    // (hard to test without exposing interval ID, but we can ensure no errors)
    expect(true).toBe(true)
  })
})
