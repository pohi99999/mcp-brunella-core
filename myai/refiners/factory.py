"""
BAS Enterprise Suite - Refiner Factory

Dynamic Pydantic schema loader for validating and structuring incoming data
based on enterprise module type.

Version: 1.0.0
Author: BAS Enterprise Team
"""

from typing import Type, Union, Any, Dict, List
from pydantic import BaseModel, Field, ValidationError, field_validator
from datetime import datetime, date
from enum import Enum


# ============================================================================
# Enums for validation
# ============================================================================

class CompanySize(str, Enum):
    STARTUP = "startup"
    SME = "sme"
    ENTERPRISE = "enterprise"


class CurrencyType(str, Enum):
    HUF = "HUF"
    EUR = "EUR"
    USD = "USD"


class CarrierType(str, Enum):
    GLS = "gls"
    DPD = "dpd"
    MAGYAR_POSTA = "magyar_posta"
    OTHER = "other"


class IssueType(str, Enum):
    DELAY = "delay"
    DAMAGE = "damage"
    LOST = "lost"


# ============================================================================
# HR Module Models
# ============================================================================

class RecruitmentData(BaseModel):
    """Recruitment / CV screening data"""
    job_description: str = Field(..., min_length=10, description="Job description text")
    cv_files: List[str] = Field(default_factory=list, description="Paths to CV PDF/DOCX files")
    linkedin_urls: List[str] = Field(default_factory=list, description="LinkedIn profile URLs")
    required_skills: List[str] = Field(default_factory=list, description="Required skill tags")
    experience_years: int | None = Field(None, ge=0, le=50, description="Minimum years of experience")

    @field_validator('linkedin_urls')
    @classmethod
    def validate_linkedin_urls(cls, v: List[str]) -> List[str]:
        for url in v:
            if not url.startswith('https://www.linkedin.com/'):
                raise ValueError(f'Invalid LinkedIn URL: {url}')
        return v


class ConflictAnalysisData(BaseModel):
    """Internal conflict/sentiment analysis data"""
    thread_messages: List[Dict[str, Any]] = Field(..., min_length=2, description="Chat/email messages")
    participants: List[str] = Field(..., min_length=2, description="Participant IDs (anonymized)")

    class Config:
        # Allow extra fields for custom sentiment scores
        extra = "allow"


class CSROpportunityData(BaseModel):
    """CSR opportunity matching data"""
    company_location: str = Field(..., min_length=2, description="City or region")
    company_values: List[str] = Field(default_factory=list, description="Company value keywords")
    search_radius: int = Field(50, ge=1, le=500, description="Radius in kilometers")


# ============================================================================
# Finance Module Models
# ============================================================================

class InvoiceData(BaseModel):
    """Invoice processing and OCR extraction"""
    invoice_number: str | None = Field(None, description="Invoice number (extracted or manual)")
    amount: float | None = Field(None, gt=0, description="Invoice amount")
    currency: CurrencyType = Field(CurrencyType.HUF, description="Currency code")
    due_date: str | None = Field(None, description="Due date (ISO 8601 format)")
    vendor_name: str | None = Field(None, description="Vendor/supplier name")
    pdf_path: str | None = Field(None, description="Path to invoice PDF")
    extracted_text: str | None = Field(None, description="OCR extracted raw text")

    @field_validator('due_date')
    @classmethod
    def validate_due_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            # Validate ISO 8601 format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f'Invalid date format: {v}. Use ISO 8601 (YYYY-MM-DD)')


class GrantEligibilityData(BaseModel):
    """Grant eligibility matching"""
    company_profile: Dict[str, Any] = Field(..., description="Company profile data")
    
    # Nested model validation
    class CompanyProfile(BaseModel):
        teaor_code: str = Field(..., pattern=r'^\d{4}$', description="TEÁOR code (4 digits)")
        employee_count: int = Field(..., ge=1, le=10000, description="Number of employees")
        annual_revenue: float = Field(..., ge=0, description="Annual revenue in HUF")
        location: str = Field(..., min_length=2, description="Company location (city)")

    @field_validator('company_profile')
    @classmethod
    def validate_profile(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        # Validate nested structure
        cls.CompanyProfile(**v)
        return v


class ProcurementData(BaseModel):
    """Procurement negotiation data"""
    product_category: str = Field(..., min_length=3, description="Product category name")
    current_supplier: str = Field(..., min_length=2, description="Current supplier name")
    current_price: float = Field(..., gt=0, description="Current unit price")
    target_price_reduction: float = Field(10.0, ge=0, le=50, description="Target price reduction (%)")


# ============================================================================
# Sales Module Models
# ============================================================================

class LeadGenerationData(BaseModel):
    """Lead generation parameters"""
    industry: str = Field(..., min_length=2, description="Target industry")
    location: str = Field(..., description="Geographic location")
    company_size: CompanySize = Field(CompanySize.SME, description="Target company size")
    keywords: List[str] = Field(default_factory=list, description="Search keywords")
    target_count: int = Field(20, ge=1, le=100, description="Number of leads to generate")


class MarketIntelData(BaseModel):
    """Market intelligence / price tracking"""
    product_category: str = Field(..., min_length=3, description="Product category")
    competitors: List[str] = Field(default_factory=list, description="Competitor names")
    price_range: Dict[str, float] | None = Field(None, description="Expected price range (min/max)")

    @field_validator('price_range')
    @classmethod
    def validate_price_range(cls, v: Dict[str, float] | None) -> Dict[str, float] | None:
        if v is None:
            return v
        if 'min' not in v or 'max' not in v:
            raise ValueError('price_range must contain "min" and "max" keys')
        if v['min'] > v['max']:
            raise ValueError('price_range min cannot be greater than max')
        return v


class CampaignData(BaseModel):
    """Marketing campaign automation"""
    project_name: str = Field(..., min_length=3, description="Project/campaign name")
    target_audience: str = Field(..., description="Target audience description")
    channels: List[str] = Field(..., min_length=1, description="Marketing channels")


# ============================================================================
# Logistics Module Models
# ============================================================================

class ShipmentTrackingData(BaseModel):
    """Shipment tracking data"""
    tracking_id: str = Field(..., min_length=5, description="Tracking ID/number")
    carrier: CarrierType = Field(CarrierType.OTHER, description="Carrier name")
    expected_delivery: str | None = Field(None, description="Expected delivery date (ISO 8601)")

    @field_validator('expected_delivery')
    @classmethod
    def validate_delivery_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f'Invalid date format: {v}. Use ISO 8601')


class ComplaintData(BaseModel):
    """Delivery complaint generation"""
    tracking_id: str = Field(..., min_length=5, description="Tracking ID")
    issue_type: IssueType = Field(..., description="Type of issue")
    description: str = Field(..., min_length=10, description="Detailed description")


# ============================================================================
# Intelligence Module Models
# ============================================================================

class CompetitorAnalysisData(BaseModel):
    """Competitor analysis parameters"""
    competitors: List[str] = Field(..., min_length=1, description="Competitor names")
    metrics: List[str] = Field(..., min_length=1, description="Metrics to analyze")


class LawMonitoringData(BaseModel):
    """Legal/regulatory monitoring"""
    teaor_code: str = Field(..., pattern=r'^\d{4}$', description="TEÁOR code")
    employee_count: int = Field(..., ge=1, description="Employee count")
    keywords: List[str] = Field(default_factory=list, description="Monitoring keywords")


class TrendData(BaseModel):
    """Trend detection parameters"""
    industry: str = Field(..., min_length=2, description="Industry name")
    timeframe: str = Field("monthly", pattern=r'^(weekly|monthly|quarterly)$', description="Timeframe")


# ============================================================================
# Wiki Module Models
# ============================================================================

class ProjectIndexData(BaseModel):
    """Project indexing for knowledge base"""
    project_folder_path: str = Field(..., min_length=5, description="Path to project folder")
    client_name: str = Field(..., min_length=2, description="Client name")
    completion_date: str = Field(..., description="Project completion date (ISO 8601)")
    tags: List[str] = Field(default_factory=list, description="Project tags")

    @field_validator('completion_date')
    @classmethod
    def validate_completion_date(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f'Invalid date format: {v}. Use ISO 8601')


class KnowledgeSearchData(BaseModel):
    """Knowledge base search parameters"""
    query: str = Field(..., min_length=2, description="Search query")
    filters: Dict[str, Any] | None = Field(None, description="Optional search filters")


class ArchiveData(BaseModel):
    """Document archiving parameters"""
    file_paths: List[str] = Field(..., min_length=1, description="File paths to archive")
    naming_convention: bool = Field(True, description="Apply YYYY_MM_PARTNER_TYPE naming")


# ============================================================================
# Refiner Factory - Dynamic Schema Selector
# ============================================================================

class RefinerFactory:
    """
    Dynamic Pydantic schema selector based on module type and subtype.
    
    Usage:
        refiner = RefinerFactory.get_refiner('invoice')
        validated = refiner(**raw_data)
    """

    # Schema registry
    _schemas: Dict[str, Type[BaseModel]] = {
        # HR
        'recruitment': RecruitmentData,
        'conflict_analysis': ConflictAnalysisData,
        'csr_opportunity': CSROpportunityData,
        
        # Finance
        'invoice': InvoiceData,
        'grant_eligibility': GrantEligibilityData,
        'procurement': ProcurementData,
        
        # Sales
        'lead_generation': LeadGenerationData,
        'market_intel': MarketIntelData,
        'campaign': CampaignData,
        
        # Logistics
        'shipment_tracking': ShipmentTrackingData,
        'complaint': ComplaintData,
        
        # Intelligence
        'competitor_analysis': CompetitorAnalysisData,
        'law_monitoring': LawMonitoringData,
        'trend_detection': TrendData,
        
        # Wiki
        'project_index': ProjectIndexData,
        'knowledge_search': KnowledgeSearchData,
        'archive': ArchiveData,
    }

    @classmethod
    def get_refiner(cls, module_type: str) -> Type[BaseModel]:
        """
        Get the appropriate Pydantic model for a module type.
        
        Args:
            module_type: Module/event type (e.g., 'invoice', 'lead_generation')
        
        Returns:
            Pydantic BaseModel class for validation
        
        Raises:
            ValueError: If module_type is not registered
        """
        if module_type not in cls._schemas:
            raise ValueError(
                f'Unknown module type: {module_type}. '
                f'Available types: {", ".join(cls._schemas.keys())}'
            )
        
        return cls._schemas[module_type]

    @classmethod
    def validate_data(cls, module_type: str, raw_data: Dict[str, Any]) -> BaseModel:
        """
        Validate raw data against the appropriate schema.
        
        Args:
            module_type: Module/event type
            raw_data: Raw input data dictionary
        
        Returns:
            Validated Pydantic model instance
        
        Raises:
            ValidationError: If data doesn't match schema
            ValueError: If module_type is unknown
        """
        refiner_class = cls.get_refiner(module_type)
        return refiner_class(**raw_data)

    @classmethod
    def list_schemas(cls) -> List[str]:
        """List all registered schema types."""
        return list(cls._schemas.keys())


# ============================================================================
# Quick Test / Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example 1: Invoice validation
    try:
        invoice_data = {
            "invoice_number": "INV-2024-001",
            "amount": 150000.0,
            "currency": "HUF",
            "due_date": "2026-03-15",
            "vendor_name": "Test Supplier Ltd."
        }
        validated_invoice = RefinerFactory.validate_data('invoice', invoice_data)
        print("✅ Invoice validation passed:")
        print(validated_invoice.model_dump_json(indent=2))
    except ValidationError as e:
        print(f"❌ Invoice validation failed: {e}")

    # Example 2: Lead generation validation
    try:
        lead_data = {
            "industry": "industrial equipment",
            "location": "Hungary",
            "company_size": "sme",
            "keywords": ["valves", "automation", "industrial"],
            "target_count": 25
        }
        validated_leads = RefinerFactory.validate_data('lead_generation', lead_data)
        print("\n✅ Lead generation validation passed:")
        print(validated_leads.model_dump_json(indent=2))
    except ValidationError as e:
        print(f"❌ Lead validation failed: {e}")

    # Example 3: List all available schemas
    print("\n📋 Available schemas:")
    for schema_name in RefinerFactory.list_schemas():
        print(f"  - {schema_name}")
