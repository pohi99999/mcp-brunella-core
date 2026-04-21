/**
 * src/types/inventory.d.ts
 * Inventory system types and interfaces.
 */

export type ValuationMethod = 'FIFO' | 'WAC';

export type MovementType = 
    | 'IN'          // Bevételezés
    | 'OUT'         // Kiadás
    | 'TRANSFER'    // Raktárközi átadás
    | 'SCRAP'       // Selejtezés
    | 'ADJUSTMENT'  // Korrekció (leltár alapján)
    | 'RETURN';     // Visszáru

export type MovementStatus = 
    | 'PENDING'     // Függőben
    | 'COMPLETED'   // Befejezett
    | 'CANCELLED'   // Törölt
    | 'SHIPPED';    // Úton (szállítónál)

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    unit: string;
    category?: string;
    valuation_method: ValuationMethod;
    min_stock: number;
    reorder_point: number;
    safety_stock: number;
    current_wac_price?: number;
    current_stock: number;
    lead_time_days: number;
    supplier_id?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface InventoryMovement {
    id: string;
    item_id: string;
    movement_type: MovementType;
    status: MovementStatus;
    quantity: number;
    unit_price?: number;
    total_value?: number;
    reference?: string;
    counterparty?: string;
    location_from?: string;
    location_to?: string;
    created_by?: string;
    notes?: string;
    timestamp: string;
}

export interface InventoryBatch {
    id: string;
    item_id: string;
    purchase_date: string;
    quantity: number;
    remaining_qty: number;
    unit_price: number;
    supplier_id?: string;
    delivery_note_ref?: string;
    closed: boolean;
    created_at: string;
}

export interface InventoryStocktake {
    id: string;
    item_id: string;
    physical_count: number;
    system_count: number;
    discrepancy: number;
    discrepancy_value?: number;
    status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'BOOKED';
    root_cause?: string;
    resolution_notes?: string;
    counted_by?: string;
    location?: string;
    created_at: string;
    resolved_at?: string;
}

export interface InventoryPurchaseOrder {
    id: string;
    item_id: string;
    sku: string;
    order_qty: number;
    estimated_unit_price?: number;
    supplier_id?: string;
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
    ai_reasoning?: string;
    confidence_score?: number;
    email_draft?: string;
    approved_by?: string;
    created_at: string;
    updated_at: string;
}
