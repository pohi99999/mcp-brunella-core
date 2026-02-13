/**
 * Track TODO Widget
 *
 * Real-time track progress widget displaying TODO checkboxes
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface TrackTodoItem {
  id: string;
  text: string;
  completed: boolean;
  lineNumber: number;
}

interface TrackTodoView {
  trackId: string;
  trackTitle: string;
  status: string;
  todos: TrackTodoItem[];
  progress: number;
}

interface TrackMeta {
  id: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
}

export function TrackTodoWidget() {
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [todoView, setTodoView] = useState<TrackTodoView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load available tracks
  useEffect(() => {
    fetchTracks();
  }, []);

  // Load TODOs when track is selected
  useEffect(() => {
    if (selectedTrackId) {
      fetchTodos(selectedTrackId);
    }
  }, [selectedTrackId]);

  const fetchTracks = async () => {
    try {
      const res = await fetch('/api/v1/tracks');
      const data = await res.json();
      setTracks(data.tracks || []);

      // Auto-select first active track
      const firstActive = data.tracks.find((t: TrackMeta) => t.status === 'active' || t.status === 'in_progress');
      if (firstActive) {
        setSelectedTrackId(firstActive.id);
      }
    } catch (err) {
      console.error('Failed to fetch tracks:', err);
      setError('Failed to load tracks');
    }
  };

  const fetchTodos = async (trackId: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/tracks/${trackId}/todos`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setTodoView(data);
    } catch (err) {
      console.error('Failed to fetch TODOs:', err);
      setError('Failed to load TODOs');
      setTodoView(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleTodo = async (todoId: string) => {
    if (!selectedTrackId) return;

    try {
      const res = await fetch(`/api/v1/tracks/${selectedTrackId}/todos/${todoId}`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const updatedView = await res.json();
      setTodoView(updatedView);
    } catch (err) {
      console.error('Failed to toggle TODO:', err);
      setError('Failed to update TODO');
    }
  };

  const activeStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'archived':
        return 'bg-green-500/10 text-green-500';
      case 'active':
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Track TODO Progress</CardTitle>
        <CardDescription>
          Real-time track progress tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Track Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Track</label>
          <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a track..." />
            </SelectTrigger>
            <SelectContent>
              {tracks.map((track) => (
                <SelectItem key={track.id} value={track.id}>
                  {track.name || track.id} ({track.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-red-500/10 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* TODO List */}
        {!loading && todoView && (
          <div className="space-y-4">
            {/* Track Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{todoView.trackTitle}</h3>
                <Badge className={activeStatusColor(todoView.status)}>
                  {todoView.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {todoView.todos.filter(t => t.completed).length} / {todoView.todos.length} done
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <Progress value={todoView.progress} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">
                {todoView.progress}% complete
              </div>
            </div>

            {/* TODO Checklist */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todoView.todos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No TODO items found
                </p>
              ) : (
                todoView.todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={todo.id}
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={todo.id}
                      className={`text-sm flex-1 cursor-pointer ${
                        todo.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.text}
                    </label>
                    {todo.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400 mt-0.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !todoView && !error && selectedTrackId && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No track.md file found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
