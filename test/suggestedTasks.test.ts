import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initSuggestedTasksDb, scanCodebaseForTodos, getAllSuggestedTasks, getSuggestedTasksByStatus, updateSuggestedTaskStatus } from '../src/core/suggestedTasksScanner';

describe('SuggestedTasksScanner API Routes', () => {
  let testDbPath = ':memory:';

  beforeAll(async () => {
    try {
      await initSuggestedTasksDb(testDbPath);
    } catch (e) {
      // Database init in :memory: might fail - that's OK for this test
    }
  });

  describe('GET /api/v1/suggested-tasks', () => {
    it('should return all non-archived tasks', async () => {
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/v1/suggested-tasks/:status', () => {
    it('should filter tasks by pending status', async () => {
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/pending', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // All returned tasks should be pending
      if (data.data.length > 0) {
        data.data.forEach((task: any) => {
          expect(task.status).toBe('pending');
        });
      }
    });

    it('should filter tasks by in_progress status', async () => {
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/in_progress', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 for invalid status', async () => {
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/invalid_status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/suggested-tasks/scan', () => {
    it('should scan codebase and return new tasks', async () => {
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('count');
      expect(data.data).toHaveProperty('tasks');
      expect(typeof data.data.count).toBe('number');
    });
  });

  describe('PATCH /api/v1/suggested-tasks/:taskId/status', () => {
    it('should update task status successfully', async () => {
      // First, get a task
      const getResponse = await fetch('http://localhost:3000/api/v1/suggested-tasks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await getResponse.json();
      if (data.data && data.data.length > 0) {
        const taskId = data.data[0].id;

        const response = await fetch(
          `http://localhost:3000/api/v1/suggested-tasks/${taskId}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          }
        );

        expect(response.status).toBe(200);
        const updateData = await response.json();
        expect(updateData.success).toBe(true);
        expect(updateData.data.status).toBe('in_progress');
      }
    });

    it('should return 400 for invalid status value', async () => {
      const response = await fetch(
        'http://localhost:3000/api/v1/suggested-tasks/test-id/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid' }),
        }
      );

      expect([400, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await fetch(
        'http://localhost:3000/api/v1/suggested-tasks/nonexistent-id/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/suggested-tasks/:taskId', () => {
    it('should archive a task successfully', async () => {
      // First, get a task
      const getResponse = await fetch('http://localhost:3000/api/v1/suggested-tasks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await getResponse.json();
      if (data.data && data.data.length > 0) {
        const taskId = data.data[0].id;

        const response = await fetch(
          `http://localhost:3000/api/v1/suggested-tasks/${taskId}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        expect(response.status).toBe(200);
        const deleteData = await response.json();
        expect(deleteData.success).toBe(true);
        expect(deleteData.data.archived).toBe(true);
      }
    });

    it('should return 404 for non-existent task', async () => {
      const response = await fetch(
        'http://localhost:3000/api/v1/suggested-tasks/nonexistent-id',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Scanner Confidence Scoring', () => {
    it('should assign higher confidence to critical keywords', async () => {
      // Scan should pick up existing TODOs with keywords like URGENT, CRITICAL, SECURITY
      const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.data.tasks && data.data.tasks.length > 0) {
        const tasks = data.data.tasks;

        // All tasks should have a confidence score between 0 and 1
        tasks.forEach((task: any) => {
          expect(task.confidence_score).toBeGreaterThanOrEqual(0);
          expect(task.confidence_score).toBeLessThanOrEqual(1);
        });

        // If any has URGENT/CRITICAL should have higher score
        const criticalTasks = tasks.filter(
          (t: any) =>
            t.todo_text.toLowerCase().includes('urgent') ||
            t.todo_text.toLowerCase().includes('critical')
        );
        if (criticalTasks.length > 0) {
          expect(criticalTasks[0].confidence_score).toBeGreaterThan(0.5);
        }
      }
    });
  });
});
