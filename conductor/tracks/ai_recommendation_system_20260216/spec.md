# Technical Specification: AI Recommendation System Integration

**Track ID:** `ai_recommendation_system_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

A jelenlegi statikus ajánlórendszer helyett Brunella-alapú dinamikus ajánlási API. A frontend csak szenzor, a döntés az Orchestrator + Researcher + LanceDB RAG pipeline-on történik.

---

## 🎯 Goals

- Új REST endpoint (`/api/brunella/recommend`).
- Új MCP tool (`get_ai_recommendation`) regisztráció.
- RAG-alapú ajánló logika LanceDB-ből.
- Fallback statikus ajánlatokra 500-as hiba esetén.

---

## 📦 Data Structures

```typescript
interface RecommendationRequest {
  productId: string;
  productName: string;
  category: string;
  userContext?: {
    sessionId: string;
    lastViewedItems: string[];
    cartValue: number;
  };
}

interface RecommendationResponse {
  recommendationText: string;
  suggestedProduct: {
    id: string;
    name: string;
    price: number;
    discountCode?: string;
  };
  agentReasoning: string;
}
```

---

## 🔄 Workflow

1. Frontend POST `/api/brunella/recommend` RecommendationRequest-tel.
2. `web.ts` továbbítja az AgentManager-nek.
3. Orchestrator delegálja Researcher + DataScientist agentnek.
4. LanceDB-ből releváns termékek lekérdezése.
5. Response generálása, visszaküldés a frontendnek.
6. Hiba esetén fallback statikus ajánlóra.

---

## 🛡️ Critical Constraints

- **Latency:** 2 másodperces SLA, caching/streaming javasolt.
- **Fallback:** 500-as hiba esetén statikus ajánlás.
- **Privacy:** userSessionId anonim, PII nélkül.
- **Hallucination Control:** csak raktáron lévő termék ajánlható.

---

## ✅ Acceptance Criteria

- Ajánlási endpoint válaszol 2s alatt.
- Fallback működik Brunella hiba esetén.
- RAG relevancia >80% (manual audit).

---

*Spec v1.0 | 2026-02-16*