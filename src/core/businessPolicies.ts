export const POLICIES = {
  invoice_approval: {
    auto_approve_under: 50_000,
    manager_approval_under: 500_000,
    board_approval_above: 500_000,
    
    evaluate: (amount: number) => {
      if (amount < POLICIES.invoice_approval.auto_approve_under)
        return 'auto';
      if (amount < POLICIES.invoice_approval.manager_approval_under)
        return 'manager';
      return 'board';
    }
  },
  
  lead_priority: {
    hot_threshold: 80,
    warm_threshold: 50,
    cold_below: 30,
    
    evaluate: (score: number) => 
      score >= 80 ? 'hot' : score >= 50 ? 'warm' : 'cold'
  },
  
  llm_cost_control: {
    daily_budget_usd: 5.0,
    force_local_above: 4.0,
    alert_at: 3.0,
    
    evaluate: (dailyCost: number) => {
      if (dailyCost > POLICIES.llm_cost_control.force_local_above)
        return 'force_local';
      if (dailyCost > POLICIES.llm_cost_control.alert_at)
        return 'alert';
      return 'normal';
    }
  }
};
