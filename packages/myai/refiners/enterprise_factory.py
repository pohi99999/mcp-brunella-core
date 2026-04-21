"""
Enterprise Module Pydantic Schema Factory

Dynamically generates and validates schemas for all 14 enterprise modules:
- HR (Recruiter, Mediator, CSR)
- Finance (Guardian, Grant Hunter)
- Sales (Agent, Pricing, Negotiation)
- Logistics (Dispatcher, Knowledge)
- Intelligence (Compliance, Content, Sentiment)
"""

from typing import Any, Dict, Type, Optional, List, Union
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, validator, field_validator
import json


# ============================================================================
# PRIORITY & STATUS ENUMS
# ============================================================================

class PriorityLevel(str, Enum):
    """Event priority levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ExecutionStatus(str, Enum):
    """Module execution status"""
    SUCCESS = "success"
    FAILURE = "failure"
    PENDING = "pending"
    QUEUED = "queued"


# ============================================================================
# HR MODULE SCHEMAS
# ============================================================================

class CVData(BaseModel):
    """Recruiter Agent: CV candidate data"""
    file_path: str
    full_name: str
    email: str
    phone: Optional[str] = None
    experience_years: int
    skills: List[str]
    languages: List[str]
    education: List[str]
    certifications: Optional[List[str]] = None
    confidence_score: float = Field(ge=0, le=1)
    matched_position: Optional[str] = None
    interview_questions: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('experience_years')
    @classmethod
    def validate_experience(cls, v: int) -> int:
        if v < 0 or v > 80:
            raise ValueError('Experience years must be between 0 and 80')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/uploads/john_doe.pdf",
                "full_name": "John Doe",
                "email": "john@example.com",
                "experience_years": 5,
                "skills": ["Python", "React", "AWS"],
                "languages": ["English", "Hungarian"],
                "education": ["BS Computer Science"],
                "confidence_score": 0.92
            }
        }


class ConflictAnalysis(BaseModel):
    """Mediator Agent: Email/chat conflict analysis"""
    message_id: str
    sender: str
    recipients: List[str]
    content: str
    sentiment_score: float = Field(ge=-1, le=1)  # -1 (negative) to +1 (positive)
    emotion_detected: List[str]  # ['anger', 'frustration', 'joy', etc]
    conflict_severity: str = Field(pattern="^(low|medium|high|critical)$")
    suggested_resolution: str
    recommended_mediator: Optional[str] = None
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "msg_123456",
                "sender": "alice@company.com",
                "recipients": ["bob@company.com"],
                "sentiment_score": -0.8,
                "emotion_detected": ["anger", "frustration"],
                "conflict_severity": "high",
                "suggested_resolution": "Schedule 1:1 meeting with mediator"
            }
        }


class CSRInitiative(BaseModel):
    """Local CSR Bot: Corporate Social Responsibility task"""
    initiative_type: str  # 'volunteer', 'donation', 'partnership', 'awareness'
    title: str
    description: str
    location_geo: Dict[str, float]  # {'latitude': X, 'longitude': Y}
    radius_km: float = Field(ge=1, le=100)
    relevance_score: float = Field(ge=0, le=1)
    estimated_hours: Optional[int] = None
    impact_description: Optional[str] = None
    company_alignment: List[str]  # ['sustainability', 'education', 'health', etc]
    deadline: Optional[datetime] = None
    discovered_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "initiative_type": "volunteer",
                "title": "Local Food Bank Help",
                "location_geo": {"latitude": 47.5, "longitude": 19.0},
                "radius_km": 5,
                "relevance_score": 0.85,
                "company_alignment": ["sustainability", "community"]
            }
        }


# ============================================================================
# FINANCE MODULE SCHEMAS
# ============================================================================

class InvoiceData(BaseModel):
    """Finance Guardian: Processed invoice data"""
    invoice_no: str
    vendor_name: str
    vendor_tax_id: Optional[str] = None
    issue_date: datetime
    due_date: datetime
    amount_gross: float = Field(gt=0)
    amount_net: float = Field(gt=0)
    vat_rate: float = Field(ge=0, le=0.27)
    vat_amount: float = Field(ge=0)
    payment_status: str = Field(pattern="^(unpaid|partial|paid|overdue|disputed)$")
    items: Optional[List[Dict[str, Any]]] = None
    anomaly_detected: bool = False
    anomaly_reason: Optional[str] = None
    confidence_score: float = Field(ge=0, le=1)
    processed_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('vat_amount')
    @classmethod
    def validate_vat(cls, v: float, info) -> float:
        # VAT should roughly match: amount_gross - amount_net
        # This is a soft check, not strict
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "invoice_no": "INV-2026-001",
                "vendor_name": "Acme Corp",
                "issue_date": "2026-02-01T00:00:00Z",
                "due_date": "2026-03-01T00:00:00Z",
                "amount_gross": 120000,
                "amount_net": 100000,
                "vat_rate": 0.27,
                "vat_amount": 20000,
                "payment_status": "unpaid",
                "confidence_score": 0.95
            }
        }


class GrantOpportunity(BaseModel):
    """Grant Hunter: Government/EU grant opportunity"""
    grant_id: str
    title: str
    issuing_body: str  # 'EU', 'Hungarian Government', 'NGO', etc
    description: str
    deadline: datetime
    min_amount: float = Field(ge=0)
    max_amount: float = Field(gt=0)
    eligible_sectors: List[str]
    company_eligibility: float = Field(ge=0, le=1)  # Confidence 0-100%
    required_documents: List[str]
    application_url: str
    relevance_score: float = Field(ge=0, le=1)
    status: str = Field(pattern="^(upcoming|active|closing_soon|closed)$")
    discovered_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "grant_id": "EU-2026-DIGITAL-001",
                "title": "Digital Transformation Grant",
                "issuing_body": "EU",
                "deadline": "2026-12-31T23:59:59Z",
                "min_amount": 50000,
                "max_amount": 500000,
                "eligible_sectors": ["ICT", "Manufacturing"],
                "company_eligibility": 0.88,
                "status": "active",
                "relevance_score": 0.91
            }
        }


# ============================================================================
# SALES MODULE SCHEMAS
# ============================================================================

class SalesLead(BaseModel):
    """Sales Agent: Prospective client lead"""
    lead_id: str
    company_name: str
    industry: str
    company_size: str = Field(pattern="^(startup|small|medium|large|enterprise)$")
    decision_maker_name: str
    decision_maker_email: str
    decision_maker_linkedin: Optional[str] = None
    company_revenue_est: Optional[float] = None
    pain_points: List[str]
    recommended_product: str
    outreach_template: Optional[str] = None
    priority: PriorityLevel
    quality_score: float = Field(ge=0, le=1)
    discovered_at: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(pattern="^(linkedin|maps|web|email|referral|other)$")

    class Config:
        json_schema_extra = {
            "example": {
                "lead_id": "lead_20260217_001",
                "company_name": "TechStartup Inc",
                "industry": "SaaS",
                "company_size": "small",
                "decision_maker_name": "Alice Johnson",
                "decision_maker_email": "alice@techstartup.com",
                "pain_points": ["Cost optimization", "API scalability"],
                "recommended_product": "Enterprise Cloud Solution",
                "priority": "HIGH",
                "quality_score": 0.87,
                "source": "linkedin"
            }
        }


class PricingStrategy(BaseModel):
    """Pricing Agent: Dynamic pricing recommendation"""
    product_id: str
    current_price: float = Field(gt=0)
    competitor_price: Optional[float] = Field(ge=0)
    market_demand: float = Field(ge=-1, le=1)  # -1 (low) to +1 (high)
    suggested_price: float = Field(gt=0)
    price_change_percent: float
    reasoning: str
    confidence_score: float = Field(ge=0, le=1)
    effective_from: datetime
    trend_analysis: Optional[str] = None
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "product_id": "prod_enterprise_lite",
                "current_price": 50000,
                "competitor_price": 48000,
                "market_demand": 0.7,
                "suggested_price": 52000,
                "price_change_percent": 4.0,
                "reasoning": "Demand rising, quality premium justified",
                "confidence_score": 0.82
            }
        }


class NegotiationDraft(BaseModel):
    """Negotiation Engine: AI-generated negotiation letter"""
    negotiation_id: str
    vendor_name: str
    current_terms: Dict[str, Any]
    proposed_terms: Dict[str, Any]
    negotiation_strategy: str  # 'aggressive', 'moderate', 'collaborative'
    letter_draft: str
    expected_savings: Optional[float] = Field(ge=0)
    timeline: Optional[str] = None
    success_probability: float = Field(ge=0, le=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "negotiation_id": "neg_2026_vendor_acme",
                "vendor_name": "Acme Corp",
                "negotiation_strategy": "collaborative",
                "expected_savings": 15000,
                "success_probability": 0.75
            }
        }


# ============================================================================
# LOGISTICS MODULE SCHEMAS
# ============================================================================

class ShipmentTracking(BaseModel):
    """Dispatch Agent: Real-time shipment tracking"""
    tracking_id: str
    carrier: str
    origin: str
    destination: str
    current_location: Optional[Dict[str, float]] = None
    status: str = Field(pattern="^(pending|in_transit|delayed|delivered|failed)$")
    estimated_delivery: datetime
    actual_delivery: Optional[datetime] = None
    last_update: datetime = Field(default_factory=datetime.utcnow)
    alerts: List[str] = []
    weather_impact: Optional[str] = None
    insurance_value: Optional[float] = Field(ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "tracking_id": "ship_20260217_001",
                "carrier": "DPD",
                "origin": "Budapest",
                "destination": "Vienna",
                "status": "in_transit",
                "estimated_delivery": "2026-02-20T10:00:00Z",
                "alerts": ["Weather delay expected"],
                "insurance_value": 50000
            }
        }


class KnowledgeEntry(BaseModel):
    """Knowledge App: Project/archived knowledge entry"""
    entry_id: str
    project_name: str
    project_type: str
    completion_date: datetime
    teams_involved: List[str]
    key_learnings: List[str]
    challenges_overcome: List[str]
    roi_estimate: Optional[float] = None
    case_study_draft: Optional[str] = None
    searchable_tags: List[str]
    vectors_stored: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "entry_id": "know_project_2025_cloud",
                "project_name": "Cloud Migration Project",
                "project_type": "infrastructure",
                "completion_date": "2025-12-15T00:00:00Z",
                "teams_involved": ["DevOps", "Finance"],
                "key_learnings": ["Cost optimization", "Team coordination"],
                "ROI_estimate": 250000,
                "searchable_tags": ["cloud", "migration", "cost-saving"]
            }
        }


# ============================================================================
# INTELLIGENCE MODULE SCHEMAS
# ============================================================================

class ComplianceAlert(BaseModel):
    """Compliance Detective: Regulatory/legal alert"""
    alert_id: str
    source: str  # 'Hungarian Gazette', 'EU Official Journal', 'SEC', etc
    regulation_title: str
    regulation_date: datetime
    deadline: Optional[datetime] = None
    relevance_score: float = Field(ge=0, le=1)
    affected_departments: List[str]
    summary: str
    required_actions: List[str]
    impact_level: str = Field(pattern="^(low|medium|high|critical)$")
    responsible_party: Optional[str] = None
    discovered_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "alert_id": "comp_2026_001",
                "source": "Hungarian Gazette",
                "regulation_title": "New Data Privacy Requirements",
                "relevance_score": 0.92,
                "affected_departments": ["IT", "HR", "Finance"],
                "impact_level": "high",
                "deadline": "2026-06-01T00:00:00Z"
            }
        }


class ContentDraft(BaseModel):
    """Content Agent: Marketing content generated from project"""
    content_id: str
    source_project: str
    content_type: str = Field(pattern="^(case_study|blog_post|linkedin_post|whitepaper|webinar)$")
    title: str
    body: str
    target_audience: str
    key_messages: List[str]
    cta_text: str  # Call-to-action
    seo_keywords: Optional[List[str]] = None
    estimated_reach: Optional[int] = None
    publication_status: str = Field(pattern="^(draft|review|approved|published)$")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "content_id": "cont_2026_cloud_cs",
                "source_project": "Cloud Migration Project",
                "content_type": "case_study",
                "title": "How We Saved $250K in Cloud Costs",
                "publication_status": "draft",
                "target_audience": "C-suite, Finance teams"
            }
        }


class SentimentAnalysis(BaseModel):
    """Sentiment Agent: Organizational sentiment/pulse"""
    analysis_id: str
    data_source: str  # 'email', 'chat', 'survey', 'social_media'
    time_period: str
    overall_sentiment: float = Field(ge=-1, le=1)
    sentiment_breakdown: Dict[str, float]  # {'positive': 0.6, 'neutral': 0.2, 'negative': 0.2}
    key_themes: List[str]
    morale_score: float = Field(ge=0, le=100)
    hotspots: List[Dict[str, Any]]  # Areas/teams with negative sentiment
    recommendations: List[str]
    trend: str = Field(pattern="^(improving|stable|declining)$")
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "analysis_id": "sent_2026_02",
                "data_source": "email",
                "time_period": "2026-02-01 to 2026-02-17",
                "overall_sentiment": 0.45,
                "morale_score": 68,
                "key_themes": ["workload", "remote flexibility", "recognition"],
                "trend": "stable"
            }
        }


# ============================================================================
# SCHEMA FACTORY
# ============================================================================

class EnterpriseSchemaFactory:
    """
    Factory for creating and validating enterprise module schemas.
    Maps module types to their Pydantic models.
    """

    # Schema registry
    SCHEMA_REGISTRY: Dict[str, Type[BaseModel]] = {
        # HR Modules
        'HR_RECRUITER': CVData,
        'HR_MEDIATOR': ConflictAnalysis,
        'HR_CSR': CSRInitiative,
        # Finance Modules
        'FINANCE_GUARDIAN': InvoiceData,
        'FINANCE_GRANT_HUNTER': GrantOpportunity,
        # Sales Modules
        'SALES_AGENT': SalesLead,
        'SALES_PRICING': PricingStrategy,
        'SALES_NEGOTIATION': NegotiationDraft,
        # Logistics Modules
        'LOGISTICS_DISPATCHER': ShipmentTracking,
        'LOGISTICS_KNOWLEDGE': KnowledgeEntry,
        # Intelligence Modules
        'INTELLIGENCE_COMPLIANCE': ComplianceAlert,
        'INTELLIGENCE_CONTENT': ContentDraft,
        'INTELLIGENCE_SENTIMENT': SentimentAnalysis,
    }

    @classmethod
    def get_schema(cls, module_id: str) -> Optional[Type[BaseModel]]:
        """Retrieve schema for a module"""
        return cls.SCHEMA_REGISTRY.get(module_id)

    @classmethod
    def validate_payload(cls, module_id: str, payload: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[BaseModel]]:
        """
        Validate payload against module schema.
        Returns: (is_valid, error_message, validated_model)
        """
        schema = cls.get_schema(module_id)
        if not schema:
            return False, f"Unknown module: {module_id}", None

        try:
            validated = schema(**payload)
            return True, None, validated
        except Exception as e:
            return False, str(e), None

    @classmethod
    def to_dict(cls, model: BaseModel) -> Dict[str, Any]:
        """Convert validated model to dict"""
        return model.model_dump(mode='json')

    @classmethod
    def list_all_schemas(cls) -> Dict[str, Dict[str, Any]]:
        """List all available schemas with their JSON schema"""
        result = {}
        for module_id, schema_class in cls.SCHEMA_REGISTRY.items():
            result[module_id] = schema_class.model_json_schema()
        return result


# ============================================================================
# VALIDATION HELPER FUNCTIONS
# ============================================================================

def validate_enterprise_event(event_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Validate a complete enterprise event"""
    required_fields = ['module', 'type', 'payload', 'priority']
    for field in required_fields:
        if field not in event_data:
            return False, f"Missing required field: {field}"

    # Validate priority
    try:
        PriorityLevel(event_data['priority'])
    except ValueError:
        return False, f"Invalid priority: {event_data['priority']}"

    return True, None


def parse_and_validate(module_id: str, raw_payload: Union[str, Dict[str, Any]]) -> tuple[bool, Optional[str], Optional[BaseModel]]:
    """
    Parse raw payload (JSON string or dict) and validate against schema
    """
    # Parse if string
    if isinstance(raw_payload, str):
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)}", None
    else:
        payload = raw_payload

    # Validate against schema
    return EnterpriseSchemaFactory.validate_payload(module_id, payload)


if __name__ == '__main__':
    # Example usage
    print("✅ Enterprise Schema Factory initialized")
    print(f"📋 Available modules: {len(EnterpriseSchemaFactory.SCHEMA_REGISTRY)}")
    
    # Show all module schemas
    for module_id in EnterpriseSchemaFactory.SCHEMA_REGISTRY.keys():
        print(f"  - {module_id}")
