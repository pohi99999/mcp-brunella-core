import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPPLY_MATCHER = path.resolve(__dirname, "../../myai/workers/supply_matcher.py");
const ROUTE_OPTIMIZER = path.resolve(__dirname, "../../myai/workers/route_optimizer.py");

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
   * callSupplyMatcher - Python supply_matcher.py hívás (Phase 2)
   */
  private callSupplyMatcher(region: string, mock = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = mock ? ["--mock"] : [];
      const proc = spawn("python", [SUPPLY_MATCHER, ...args], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      
      if (!mock) {
        // Here we would pass actual scraped capacities if they were in the context
        const input = JSON.stringify({ region, capacities: [] });
        proc.stdin.write(input);
      }
      proc.stdin.end();

      proc.on("close", (code) => {
        if (code !== 0) return reject(new Error(stderr || `Exit ${code}`));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error("Match JSON hiba."));
        }
      });
    });
  }

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

      if (task.toLowerCase().includes('match') || task.toLowerCase().includes('párosít')) {
        const region = (context as any)?.region || "Budapest";
        const mock = (context as any)?.mock ?? task.includes("mock");
        logInfo(this.name, `Példány párosítás indítása: ${region}`);

        try {
          const matchResult = await this.callSupplyMatcher(region, mock);
          const report = matchResult.summary 
            ? `📊 Párosítás kész: ${matchResult.summary.matches} párosítva, ${matchResult.summary.avg_score}/10 átlag score.\n${matchResult.alerts.join("\n")}`
            : `📊 Párosítás kész: ${matchResult.matches.length} párosítva.`;

          return {
        success: true,
        status: 'success',
        message: matchResult.summary 
          ? `📊 Párosítás kész: ${matchResult.summary.matches} párosítva.`
          : `📊 Párosítás kész: ${matchResult.matches.length} párosítva.`,
        data: matchResult
      };
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          logError(this.name, `Match hiba: ${error}`);
          return { status: 'error', error };
        }
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
      success: true,
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
   * callRouteOptimizer - Python route_optimizer.py hívás (Phase 3)
   */
  private callRouteOptimizer(locations: any[], mock = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = mock ? ["--mock"] : [];
      const proc = spawn("python", [ROUTE_OPTIMIZER, ...args], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      
      if (!mock) {
        const input = JSON.stringify({ locations });
        proc.stdin.write(input);
      }
      proc.stdin.end();

      proc.on("close", (code) => {
        if (code !== 0) return reject(new Error(stderr || `Exit ${code}`));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error("Route JSON hiba."));
        }
      });
    });
  }

  /**
   * Optimize delivery routes
   */
  private async optimizeRoutes(_task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Útvonalak optimizálása...');

    const mock = (context as any)?.mock ?? _task.includes("mock");
    const locations = (context as any)?.locations || [];

    try {
      const routeResult = await this.callRouteOptimizer(locations, mock);
      
      const route: Route = {
        routeId: `ROUTE-${Date.now()}`,
        shipments: [], // No real mapping yet from points back to shipments
        totalDistance: routeResult.total_distance,
        estimatedTime: routeResult.total_distance / 60, // Assumed 60 km/h avg
        waypointCount: routeResult.route?.length || 0,
        optimizationScore: routeResult.optimization_score || 90,
        estimatedCost: routeResult.total_distance * 0.15, // Cost per km
        environmentalImpact: {
          co2Emissions: routeResult.total_distance * 0.1, // kg/km
          fuelConsumption: routeResult.total_distance * 0.08 // liters/km
        }
      };

      this.routes.set(route.routeId, route);

      logInfo(this.name, `Útvonal optimizálva: ${route.routeId} (${route.optimizationScore}% hatékonyság)`);

      return {
        success: true,
        status: 'success',
        message: `🏁 Útvonal optimizálva: ${route.totalDistance} km, ${route.waypointCount} megálló.`,
        data: {
          ...routeResult,
          route_id: route.routeId
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Route optimization hiba: ${error}`);
      return { status: 'error', error };
    }
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
      success: true,
      status: 'success',
      data: {
        totalNotifications: mockShipments.length,
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
