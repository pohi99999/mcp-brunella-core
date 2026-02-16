# Technical Specification: Marketing Swarm (Automated Marketing Campaign)

**Track ID:** `marketing_swarm_20260216`  
**Status:** `in_progress` (Phase 1 Complete ✅)
**Last Updated:** 2026-02-16T05:15:00Z  
**Progress:** 33% (Phase 1/3 complete)  

---

## 📖 Context

Egy koordinált marketing-ügynökraj (Swarm) automatizálja a trendkutatást, tartalomgyártást, média-eszközök előállítását és kampánycsomag összeállítását. A rendszer egyetlen parancsra készít social posztokat, email draftokat, landing page vázlatot és mediacsalagot.

---

## 🎯 Goals

- Trendkutatás és piaci insight automatikus előállítása.
- Több platformra optimalizált kampánycsomag (LinkedIn, Instagram, Web).
- Media assetek generálása vagy „Draft Mode” placeholderrel.
- Kampánycsomag mentése a `_KNOWLEDGE_BASE/campaigns/` struktúrába.

---

## 🧱 System Components

- `src/agents/MarketingDirectorAgent.ts` – Swarm koordinátor
- `src/agents/CopywriterAgent.ts` – szövegíró agent
- `myai/workers/trend_analyst.py` – trendkutatás (browser-use)
- `myai/workers/media_factory.py` – média generálás (image/video script)
- `src/tools/workspace.ts` – fájlmentés, csomagolás

---

## 📦 Data Structures

```typescript
export interface MarketingCampaignRequest {
  productName: string;
  description: string;
  targetAudience?: string;
  platforms: ('linkedin' | 'instagram' | 'web')[];
}

export interface MarketTrendReport {
  keywords: string[];
  visualStyle: string;
  competitorHooks: string[];
  viralTopics: string[];
}

export interface CampaignPackage {
  campaignId: string;
  assets: {
    copywriting: {
      slogans: string[];
      socialPosts: Record<string, string>;
      emailDraft: string;
    };
    mediaFiles: string[];
    landingPageSpec: string;
  };
  status: 'DRAFT' | 'READY_FOR_REVIEW';
}
```

---

## 🔄 Workflow

1. **Trigger:** MarketingDirectorAgent fogadja a MarketingCampaignRequest-et.
2. **Trend Analysis:** `trend_analyst.py` kinyer kulcsszavakat, trendeket, vizuális stílust.
3. **Copywriting:** CopywriterAgent generál posztokat + email draftot.
4. **Media Production:** `media_factory.py` generál képeket/videó scripteket (Draft Mode opcionálisan).
5. **Assembly:** Output mentése `_KNOWLEDGE_BASE/campaigns/[DATE]_[PRODUCT]/`.
6. **Review:** Dashboardon csomag státusz `READY_FOR_REVIEW`.

---

## 🛡️ Critical Constraints

- **Draft Mode:** media generálás költségkontroll miatt alapértelmezett.
- **No `any`:** minden ügynökközi payload szigorúan typizált.
- **Timeout handling:** trendkutatás max 3 perc, job queue szükséges.
- **Fájlstruktúra:** kizárólag `_KNOWLEDGE_BASE` alá mentés.

---

## ✅ Acceptance Criteria (Phase 1 COMPLETE)

### Implementált:
- ✅ **CopywriterAgent** - TOML-based DynamicAgent, regisztrálva az API-n
- ✅ **MarketingDirectorAgent** - TOML-based DynamicAgent, regisztrálva az API-n
- ✅ **Dashboard integráció** - Mindkét agent látható a dashboard-on
- ✅ **CLI integráció** - `brunella agents` parancsban felsorolva
- ✅ **API endpoint** - GET `/api/agents` mindkettőt visszaadja
- ✅ **Accessibility** - WCAG 2.1 AA audit passed (3 aria-label fix)
- ✅ **Build validation** - `npm run build` → 0 errors, 0 warnings

### Megvalósított Ügynök Tulajdonságok:

**CopywriterAgent** (`copywriter`)
- Category: `content_creation`
- Capabilities: `social_media_copywriting`, `email_marketing`, `headline_generation`
- LLM: Gemini / GitHub Models / Ollama
- Status: ✅ Production-ready

**MarketingDirectorAgent** (`marketing_director`)
- Category: `marketing_orchestration`
- Capabilities: `campaign_strategy`, `audience_analysis`, `content_delegation`
- LLM: Gemini / GitHub Models / Ollama
- Status: ✅ Production-ready

### Awaiting Phase 2:
- [ ] Trend Analyst worker (`myai/workers/trend_analyst.py`)
- [ ] Media Factory worker (`myai/workers/media_factory.py`)
- [ ] Campaign Package Assembly

---

*Phase 1 Complete | Ready for Phase 2*

---

*Spec v1.0 | 2026-02-16*