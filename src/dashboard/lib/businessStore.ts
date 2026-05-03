import { create } from 'zustand';
import { BusinessJob } from '../types/dashboard.js';
import { apiService } from './apiService.js';

interface BusinessStore {
  jobs: BusinessJob[];
  isLoading: boolean;
  error: string | null;
  fetchJobs: (type?: string) => Promise<void>;
  createJob: (type: string, query: string, metadata?: any) => Promise<string | null>;
  updateJobStatus: (id: string, status: BusinessJob['status'], results?: any) => void;
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  jobs: [],
  isLoading: false,
  error: null,

  fetchJobs: async (type?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Assuming apiService.getBusinessJobs exists or using generic fetch
      const response = await fetch(`/api/v1/business-jobs${type ? `?type=${type}` : ''}`);
      const data = await response.json();
      if (data.success) {
        set({ jobs: data.jobs, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createJob: async (type: string, query: string, extraParams?: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/business-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, query, ...extraParams })
      });
      const data = await response.json();
      if (data.success) {
        await get().fetchJobs(type);
        set({ isLoading: false });
        return data.jobId;
      } else {
        set({ error: data.error, isLoading: false });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  updateJobStatus: (id: string, status: BusinessJob['status'], results?: any) => {
    set((state) => ({
      jobs: state.jobs.map((job) => 
        job.id === id 
          ? { ...job, status, results_json: results ? JSON.stringify(results) : job.results_json } 
          : job
      )
    }));
  }
}));
