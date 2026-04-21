import { EventEmitter } from 'events';

export type ActivityType = 'info' | 'success' | 'warning' | 'error' | 'approval';
export type ActivitySource = 'system' | 'agent' | 'user' | 'pipeline' | 'git' | 'queue';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    source: ActivitySource;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
}

export class ActivityFeedManager extends EventEmitter {
    private activities: ActivityItem[] = [];
    private maxHistory: number = 200;

    constructor() {
        super();
    }

    /**
     * Add a new activity to the feed
     */
    addActivity(
        type: ActivityType,
        source: ActivitySource,
        message: string,
        metadata?: Record<string, unknown>
    ): ActivityItem {
        const item: ActivityItem = {
            id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type,
            source,
            message,
            metadata,
            timestamp: new Date().toISOString()
        };

        this.activities.unshift(item); // Add to beginning

        // Trim history
        if (this.activities.length > this.maxHistory) {
            this.activities = this.activities.slice(0, this.maxHistory);
        }

        this.emit('activity', item);
        return item;
    }

    /**
     * Get recent activities
     */
    getRecent(limit: number = 50): ActivityItem[] {
        return this.activities.slice(0, limit);
    }

    /**
     * Clear feed history (useful for tests)
     */
    clear() {
        this.activities = [];
    }
}

export const activityFeed = new ActivityFeedManager();
