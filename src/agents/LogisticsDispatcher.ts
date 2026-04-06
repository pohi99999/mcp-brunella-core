import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { googleWorkspaceHandler, type GoogleWorkspaceResult } from '../tools/unifiedGoogleWorkspaceTool.js';

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
 * Draft Outreach Email (Phase 4)
 */
interface OutreachDraft {
  draftId: string;
  to: string[];
  subject: string;
  body: string;
  approved: boolean;
  createdAt: Date;
  approvedAt?: Date;
  sentAt?: Date;
  matchData?: unknown;
}

interface LogisticsPartner {
  name?: string;
  email: string;
}

interface MatchSummary {
  matches: number;
  avg_score: number;
}

interface SupplyMatchResult {
  summary?: MatchSummary;
  alerts: string[];
  matches: unknown[];
}

interface RouteOptimizationResult {
  total_distance: number;
  route: unknown[];
  optimization_score: number;
}

interface LogisticsContext {
  region?: string;
  mock?: boolean;
  locations?: unknown[];
  matchData?: SupplyMatchResult;
  partners?: LogisticsPartner[];
  draftId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLogisticsPartner(value: unknown): value is LogisticsPartner {
  return isRecord(value) && typeof value.email === 'string' && (value.name === undefined || typeof value.name === 'string');
}

function isLogisticsPartnerArray(value: unknown): value is LogisticsPartner[] {
  return Array.isArray(value) && value.every(isLogisticsPartner);
}

function normalizeMatchSummary(value: unknown): MatchSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const matches = typeof value.matches === 'number' ? value.matches : undefined;
  const avgScore = typeof value.avg_score === 'number' ? value.avg_score : undefined;

  if (matches === undefined || avgScore === undefined) {
    return undefined;
  }

  return { matches, avg_score: avgScore };
}

function normalizeSupplyMatchResult(value: unknown): SupplyMatchResult {
  if (!isRecord(value)) {
    return { alerts: [], matches: [] };
  }

  const alerts = Array.isArray(value.alerts) ? value.alerts.filter((alert): alert is string => typeof alert === 'string') : [];
  const matches = Array.isArray(value.matches) ? value.matches : [];

  return {
    summary: normalizeMatchSummary(value.summary),
    alerts,
    matches
  };
}

function normalizeRouteOptimizationResult(value: unknown): RouteOptimizationResult {
  if (!isRecord(value)) {
    return { total_distance: 0, route: [], optimization_score: 90 };
  }

  return {
    total_distance: typeof value.total_distance === 'number' ? value.total_distance : 0,
    route: Array.isArray(value.route) ? value.route : [],
    optimization_score: typeof value.optimization_score === 'number' ? value.optimization_score : 90
  };
}

function normalizeLogisticsContext(context: unknown): LogisticsContext {
  if (!isRecord(context)) {
    return {};
  }

  const normalized: LogisticsContext = {};

  if (typeof context.region === 'string') {
    normalized.region = context.region;
  }

  if (typeof context.mock === 'boolean') {
    normalized.mock = context.mock;
  }

  if (Array.isArray(context.locations)) {
    normalized.locations = context.locations;
  }

  if (isRecord(context.matchData)) {
    normalized.matchData = normalizeSupplyMatchResult(context.matchData);
  }

  if (isLogisticsPartnerArray(context.partners)) {
    normalized.partners = context.partners;
  }

  if (typeof context.draftId === 'string') {
    normalized.draftId = context.draftId;
  }

  return normalized;
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
  private drafts: Map<string, OutreachDraft> = new Map();

  /**
   * callSupplyMatcher - Python supply_matcher.py hívás (Phase 2)
   */
  private callSupplyMatcher(region: string, mock = false): Promise<SupplyMatchResult> {
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
          const parsed: unknown = JSON.parse(stdout.trim());
          resolve(normalizeSupplyMatchResult(parsed));
        } catch (error: unknown) {
          const err = ensureError(error);
          reject(new Error(`Match JSON hiba. ${err.message}`));
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
      const logisticsContext = normalizeLogisticsContext(context);

      if (task.toLowerCase().includes('track') || task.toLowerCase().includes('követ')) {
        return await this.trackShipments(task, context);
      }

      if (task.toLowerCase().includes('route') || task.toLowerCase().includes('útvonal')) {
        return await this.optimizeRoutes(task, context);
      }

      if (task.toLowerCase().includes('match') || task.toLowerCase().includes('párosít')) {
        const region = logisticsContext.region || "Budapest";
        const mock = logisticsContext.mock ?? task.includes("mock");
        logInfo(this.name, `Példány párosítás indítása: ${region}`);

        try {
          const matchResult = await this.callSupplyMatcher(region, mock);

          return {
            success: true,
            status: 'success',
            message: matchResult.summary
              ? `📊 Párosítás kész: ${matchResult.summary.matches} párosítva.`
              : `📊 Párosítás kész: ${matchResult.matches.length} párosítva.`,
            data: matchResult
          };
        } catch (error: unknown) {
          const err = ensureError(error);
          logError(this.name, `Match hiba: ${err.message}`);
          return { status: 'error', error: err.message };
        }
      }

      if (task.toLowerCase().includes('notify') || task.toLowerCase().includes('értesít')) {
        return await this.manageNotifications(task, context);
      }

      // Phase 4: Draft & Approval Workflow (specific keyword matching)
      if (task.toLowerCase().includes('approve') || task.toLowerCase().includes('jóváhagy')) {
        return await this.approveDraft(task, context);
      }

      if (task.toLowerCase().includes('send') && (task.toLowerCase().includes('email') || task.toLowerCase().includes('draft'))) {
        return await this.sendApprovedDraft(task, context);
      }

      if (task.toLowerCase().includes('draft') || task.toLowerCase().includes('outreach') || task.toLowerCase().includes('levél')) {
        return await this.createOutreachDraft(task, context);
      }

      // Default: track shipments
      return await this.trackShipments(task, context);
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, err.message);
      return { status: 'error', error: err.message };
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
  private callRouteOptimizer(locations: unknown[], mock = false): Promise<RouteOptimizationResult> {
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
          const parsed: unknown = JSON.parse(stdout.trim());
          resolve(normalizeRouteOptimizationResult(parsed));
        } catch (error: unknown) {
          const err = ensureError(error);
          reject(new Error(`Route JSON hiba. ${err.message}`));
        }
      });
    });
  }

  /**
   * Optimize delivery routes
   */
  private async optimizeRoutes(_task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Útvonalak optimizálása...');

    const logisticsContext = normalizeLogisticsContext(context);
    const mock = logisticsContext.mock ?? _task.includes("mock");
    const locations = logisticsContext.locations || [];

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
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Route optimization hiba: ${err.message}`);
      return { status: 'error', error: err.message };
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
        totalNotifications: this.shipmentDatabase.size,
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

  /**
   * Create outreach draft email (Phase 4)
   * Human-in-the-loop approval required before sending
   */
  private async createOutreachDraft(_task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, '📝 Draft email létrehozása freight partnereknek...');

    const logisticsContext = normalizeLogisticsContext(context);
    const matchData: SupplyMatchResult = logisticsContext.matchData || { alerts: [], matches: [] };
    const partners = logisticsContext.partners || [
      { name: 'TIMOCOM Transport', email: 'contact@timocom.example.com' },
      { name: 'Trans.eu Freight', email: 'freight@trans.eu.example.com' }
    ];

    const to = partners.map((partner) => partner.email);
    const subject = 'Freight Capacity Partnership Opportunity - Budapest Region';
    const body = `
Dear Partner,

We are reaching out to explore potential collaboration opportunities in the Budapest region freight capacity market.

Our analysis shows strong demand for:
- Pallet capacity: 15-20 pallets
- Heavy goods transport
- Regular routes: Budapest → Vienna, Budapest → Prague

${matchData.summary ? 
  `We have identified ${matchData.summary.matches} potential matches with an average score of ${matchData.summary.avg_score}/10.` 
  : 'We believe there are significant synergies between our logistics networks.'}

Would you be interested in discussing a partnership?

Best regards,
Logistics Dispatch Team

---
*This is a draft email. Please review and approve before sending.*
    `.trim();

    try {
      // Create draft via Gmail API
      const result = await googleWorkspaceHandler({
        operation: 'email_draft',
        params: { to, subject, body }
      }) as GoogleWorkspaceResult;

      if (!result.success) {
        throw new Error(result.error || 'Draft creation failed');
      }

      const draftId = isRecord(result.data) && typeof result.data.draftId === 'string'
        ? result.data.draftId
        : `draft_${Date.now()}`;

      // Store draft for approval tracking
      const draft: OutreachDraft = {
        draftId,
        to,
        subject,
        body,
        approved: false,
        createdAt: new Date(),
        matchData
      };

      this.drafts.set(draftId, draft);

      logInfo(this.name, `✅ Draft létrehozva: ${draftId} (${to.length} címzett)`);

      return {
        success: true,
        status: 'success',
        message: `📧 Draft email létrehozva ${to.length} partnernek. Jóváhagyásra vár!`,
        data: {
          draftId,
          recipients: to,
          subject,
          bodyPreview: body.slice(0, 150) + '...',
          requiresApproval: true,
          createdAt: draft.createdAt
        }
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Draft creation hiba: ${err.message}`);
      return { status: 'error', error: err.message };
    }
  }

  /**
   * Approve draft email (Human-in-the-loop)
   */
  private async approveDraft(_task: string, context?: unknown): Promise<AgentResponse> {
    const logisticsContext = normalizeLogisticsContext(context);
    const draftId = logisticsContext.draftId || Array.from(this.drafts.keys())[0];

    if (!draftId) {
      return {
        status: 'error',
        error: 'Nincs draft ID megadva és nincs elérhető draft.'
      };
    }

    const draft = this.drafts.get(draftId);
    if (!draft) {
      return {
        status: 'error',
        error: `Draft nem található: ${draftId}`
      };
    }

    if (draft.approved) {
      return {
        status: 'success',
        message: `✅ Draft ${draftId} már korábban jóvá lett hagyva.`,
        data: { draftId, approvedAt: draft.approvedAt }
      };
    }

    // Approve draft
    draft.approved = true;
    draft.approvedAt = new Date();
    this.drafts.set(draftId, draft);

    logInfo(this.name, `✅ Draft jóváhagyva: ${draftId}`);

    return {
      success: true,
      status: 'success',
      message: `✅ Draft ${draftId} jóváhagyva. Most már elküldhető!`,
      data: {
        draftId,
        approvedAt: draft.approvedAt,
        recipients: draft.to,
        readyToSend: true
      }
    };
  }

  /**
   * Send approved draft email
   * Only sends if draft is approved (Human-in-the-loop safety)
   */
  private async sendApprovedDraft(_task: string, context?: unknown): Promise<AgentResponse> {
    const logisticsContext = normalizeLogisticsContext(context);
    const draftId = logisticsContext.draftId || Array.from(this.drafts.keys()).find(
      id => this.drafts.get(id)?.approved && !this.drafts.get(id)?.sentAt
    );

    if (!draftId) {
      return {
        status: 'error',
        error: 'Nincs jóváhagyott, de még el nem küldött draft.'
      };
    }

    const draft = this.drafts.get(draftId);
    if (!draft) {
      return {
        status: 'error',
        error: `Draft nem található: ${draftId}`
      };
    }

    if (!draft.approved) {
      return {
        status: 'error',
        error: `❌ Draft ${draftId} nincs jóváhagyva. Küldés megtagadva!`
      };
    }

    if (draft.sentAt) {
      return {
        status: 'error',
        error: `Draft ${draftId} már el lett küldve: ${draft.sentAt.toLocaleString()}`
      };
    }

    try {
      // Send email via Gmail API
      const result = await googleWorkspaceHandler({
        operation: 'email_send',
        params: {
          to: draft.to,
          subject: draft.subject,
          body: draft.body
        }
      }) as GoogleWorkspaceResult;

      if (!result.success) {
        throw new Error(result.error || 'Email sending failed');
      }

      draft.sentAt = new Date();
      this.drafts.set(draftId, draft);

      logInfo(this.name, `📧 Email elküldve: ${draftId} (${draft.to.length} címzett)`);

      return {
        success: true,
        status: 'success',
        message: `📧 Email sikeresen elküldve ${draft.to.length} partnernek!`,
        data: {
          draftId,
          recipients: draft.to,
          sentAt: draft.sentAt,
          messageId: isRecord(result.data) && typeof result.data.messageId === 'string'
            ? result.data.messageId
            : undefined
        }
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Email sending hiba: ${err.message}`);
      return { status: 'error', error: err.message };
    }
  }
}

export default LogisticsDispatcher;
