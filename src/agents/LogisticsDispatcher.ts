import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Shipment Tracking Data
 */
interface Shipment {
  trackingId: string;
  origin: string;
  destination: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed' | 'lost';
  estimatedDelivery: Date;
  actualDelivery?: Date;
  carrier: string;
  weight: number; // kg
  items: Array<{ sku: string; description: string; quantity: number }>;
  lastUpdate: Date;
  currentLocation?: string;
}

/**
 * Route Optimization Data
 */
interface Route {
  routeId: string;
  shipments: Shipment[];
  totalDistance: number; // km
  estimatedTime: number; // hours
  waypointCount: number;
  optimizationScore: number; // 0-100
  estimatedCost: number; // currency
  environmentalImpact: {
    co2Emissions: number; // kg
    fuelConsumption: number; // liters
  };
}

/**
 * Proactive Notification
 */
interface ProactiveNotification {
  shipmentId: string;
  notificationType: 'delay' | 'delivery_soon' | 'location_update' | 'issue_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendedAction?: string;
  timestamp: Date;
  sent: boolean;
}

/**
 * LogisticsDispatcher - Logisztikai Diszpécser
 * Manages shipment tracking, route optimization, and proactive notifications
 */
export class LogisticsDispatcher implements IAgent {
  name = 'LogisticsDispatcher';
  role = 'Supply Chain & Logistics';
  description = 'Logisztikai Diszpécser - Szállítmány követés, szállítási optimizálás, proaktív értesítések';
  capabilities = [
    'tracking_extraction',
    'route_optimization',
    'proactive_notifications',
    'carrier_coordination',
    'delivery_scheduling'
  ];

  private shipmentDatabase: Map<string, Shipment> = new Map();
  private routes: Map<string, Route> = new Map();
  private notifications: ProactiveNotification[] = [];

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      if (task.toLowerCase().includes('track') || task.toLowerCase().includes('követ')) {
        return await this.trackShipments(task, context);
      }

      if (task.toLowerCase().includes('route') || task.toLowerCase().includes('útvonal')) {
        return await this.optimizeRoutes(task, context);
      }

      if (task.toLowerCase().includes('notify') || task.toLowerCase().includes('értesít')) {
        return await this.manageNotifications(task, context);
      }

      // Default: track shipments
      return await this.trackShipments(task, context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Track shipments and extract tracking IDs
   */
  private async trackShipments(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Szállítmányok nyomon követése...');

    // Mock shipments for tracking
    const mockShipments: Shipment[] = [
      {
        trackingId: 'TRACK-001-2026',
        origin: 'Budapest',
        destination: 'Vienna',
        status: 'in_transit',
        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
        carrier: 'DHL Express',
        weight: 15,
        items: [
          { sku: 'PROD-001', description: 'Electronic Device', quantity: 1 },
          { sku: 'PROD-002', description: 'Accessories Pack', quantity: 2 }
        ],
        lastUpdate: new Date(),
        currentLocation: 'Győr, Hungary'
      },
      {
        trackingId: 'TRACK-002-2026',
        origin: 'Prague',
        destination: 'Berlin',
        status: 'delayed',
        estimatedDelivery: new Date(Date.now() + 48 * 60 * 60 * 1000),
        carrier: 'DPD',
        weight: 8,
        items: [
          { sku: 'PROD-003', description: 'Software License', quantity: 5 }
        ],
        lastUpdate: new Date(),
        currentLocation: 'Dresden, Germany'
      },
      {
        trackingId: 'TRACK-003-2026',
        origin: 'Warsaw',
        destination: 'Budapest',
        status: 'delivered',
        estimatedDelivery: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        actualDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        carrier: 'GLS',
        weight: 22,
        items: [
          { sku: 'PROD-004', description: 'Office Equipment', quantity: 3 }
        ],
        lastUpdate: new Date()
      }
    ];

    // Store shipments
    for (const shipment of mockShipments) {
      this.shipmentDatabase.set(shipment.trackingId, shipment);
      logInfo(
        this.name,
        `Szállítmány követése: ${shipment.trackingId} (${shipment.status}) - ${shipment.currentLocation || 'unknown'}`
      );
    }

    // Detect and create notifications for issues
    const notifications = this.detectIssues(mockShipments);

    return {
      status: 'success',
      data: {
        trackingCount: mockShipments.length,
        shipments: mockShipments.map(s => ({
          trackingId: s.trackingId,
          status: s.status,
          origin: s.origin,
          destination: s.destination,
          currentLocation: s.currentLocation,
          estimatedDelivery: s.estimatedDelivery,
          carrier: s.carrier
        })),
        shipmentsByStatus: {
          inTransit: mockShipments.filter(s => s.status === 'in_transit').length,
          delayed: mockShipments.filter(s => s.status === 'delayed').length,
          delivered: mockShipments.filter(s => s.status === 'delivered').length,
          lost: mockShipments.filter(s => s.status === 'lost').length
        },
        alertCount: notifications.length,
        alerts: notifications
      }
    };
  }

  /**
   * Optimize delivery routes
   */
  private async optimizeRoutes(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Útvonalak optimizálása...');

    const shipments = Array.from(this.shipmentDatabase.values()).filter(
      s => s.status === 'pending' || s.status === 'in_transit'
    );

    // Create optimized route
    const route: Route = {
      routeId: `ROUTE-${Date.now()}`,
      shipments,
      totalDistance: Math.random() * 300 + 100, // 100-400 km
      estimatedTime: Math.random() * 12 + 4, // 4-16 hours
      waypointCount: shipments.length,
      optimizationScore: Math.random() * 20 + 80, // 80-100%
      estimatedCost: shipments.length * Math.random() * 50 + 100,
      environmentalImpact: {
        co2Emissions: Math.random() * 50 + 20, // kg
        fuelConsumption: Math.random() * 20 + 5 // liters
      }
    };

    this.routes.set(route.routeId, route);

    logInfo(this.name, `Útvonal optimizálva: ${route.routeId} (${route.optimizationScore}% hatékonyság)`);

    return {
      status: 'success',
      data: {
        routeId: route.routeId,
        shipmentsInRoute: route.shipments.length,
        totalDistance: Math.round(route.totalDistance * 10) / 10,
        estimatedTime: Math.round(route.estimatedTime * 10) / 10,
        optimizationScore: Math.round(route.optimizationScore),
        estimatedCost: Math.round(route.estimatedCost * 100) / 100,
        environmentalImpact: {
          co2Emissions: Math.round(route.environmentalImpact.co2Emissions * 10) / 10,
          fuelConsumption: Math.round(route.environmentalImpact.fuelConsumption * 10) / 10
        },
        recommendations: [
          'Combine nearby deliveries to reduce distance',
          'Schedule deliveries during low-traffic hours',
          'Consider electric vehicles for urban routes',
          'Implement real-time tracking to reduce delays'
        ],
        estimatedTimeSavings: `${Math.round(Math.random() * 30 + 10)} minutes`,
        estimatedCostSavings: `${Math.round(Math.random() * 200 + 50)} currency units`
      }
    };
  }

  /**
   * Manage proactive notifications
   */
  private async manageNotifications(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Proaktív értesítések kezelése...');

    const notifications: ProactiveNotification[] = [];

    // Check for delayed shipments
    for (const [trackingId, shipment] of this.shipmentDatabase) {
      if (shipment.status === 'delayed') {
        notifications.push({
          shipmentId: trackingId,
          notificationType: 'delay',
          severity: 'high',
          message: `Szállítmány ${trackingId} késésben van. Várható szállítás: ${shipment.estimatedDelivery.toLocaleDateString()}`,
          recommendedAction: 'Contact carrier for expedited delivery options',
          timestamp: new Date(),
          sent: false
        });
      }

      // Check for delivery soon
      if (
        shipment.status === 'in_transit' &&
        shipment.estimatedDelivery.getTime() - Date.now() < 24 * 60 * 60 * 1000
      ) {
        notifications.push({
          shipmentId: trackingId,
          notificationType: 'delivery_soon',
          severity: 'medium',
          message: `Szállítmány ${trackingId} hamarosan érkezik. Kérjük, készüljön fel az átvételre.`,
          recommendedAction: 'Prepare for delivery reception',
          timestamp: new Date(),
          sent: false
        });
      }

      // Periodic location updates
      if (shipment.currentLocation) {
        notifications.push({
          shipmentId: trackingId,
          notificationType: 'location_update',
          severity: 'low',
          message: `Szállítmány ${trackingId} jelenleg ${shipment.currentLocation} helyen van.`,
          timestamp: new Date(),
          sent: false
        });
      }
    }

    this.notifications.push(...notifications);

    return {
      status: 'success',
      data: {
        totalNotifications: notifications.length,
        notifications: notifications.map(n => ({
          shipmentId: n.shipmentId,
          type: n.notificationType,
          severity: n.severity,
          message: n.message,
          action: n.recommendedAction
        })),
        notificationsByType: {
          delays: notifications.filter(n => n.notificationType === 'delay').length,
          deliverySoon: notifications.filter(n => n.notificationType === 'delivery_soon').length,
          locationUpdates: notifications.filter(n => n.notificationType === 'location_update').length,
          issues: notifications.filter(n => n.notificationType === 'issue_detected').length
        },
        pendingSendCount: notifications.filter(n => !n.sent).length,
        channels: ['email', 'sms', 'push_notification', 'dashboard']
      }
    };
  }

  /**
   * Detect issues in shipments
   */
  private detectIssues(shipments: Shipment[]): ProactiveNotification[] {
    const alerts: ProactiveNotification[] = [];

    for (const shipment of shipments) {
      if (shipment.status === 'delayed') {
        alerts.push({
          shipmentId: shipment.trackingId,
          notificationType: 'delay',
          severity: 'high',
          message: `${shipment.trackingId} szállítmány késésben van!`,
          recommendedAction: 'Contact carrier immediately',
          timestamp: new Date(),
          sent: false
        });
      }

      if (shipment.status === 'lost') {
        alerts.push({
          shipmentId: shipment.trackingId,
          notificationType: 'issue_detected',
          severity: 'critical',
          message: `${shipment.trackingId} szállítmány elveszett!`,
          recommendedAction: 'Initiate claims process immediately',
          timestamp: new Date(),
          sent: false
        });
      }
    }

    return alerts;
  }
}
