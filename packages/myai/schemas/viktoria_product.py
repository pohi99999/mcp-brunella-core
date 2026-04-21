from __future__ import annotations
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class BilingualField(BaseModel):
    """Bilingual (HU/EN) container for luxury fashion attributes."""
    hu: str = Field(..., description="Hungarian value")
    en: str = Field(..., description="English value")

class LuxuryPricing(BaseModel):
    """Structure for multi-currency luxury pricing."""
    amount: float = Field(..., description="Numeric price value")
    currency: str = Field(default="EUR", description="Currency code (e.g., EUR, HUF, USD)")

class ViktoriaProduct(BaseModel):
    """
    Pydantic model for VIKTORIAVARGA luxury fashion products.
    Supports bilingual metadata, luxury standards, and brand-specific style markers.
    
    Brand Motto: 'Enjoy life in colours'
    """
    # Identification
    sku: Optional[str] = Field(None, description="Unique stock keeping unit")
    brand: str = Field(default="VIKTORIAVARGA", description="The fashion brand name")
    collection: Optional[str] = Field(None, description="Collection name (e.g., Spring/Summer 2026)")
    
    # Bilingual Product Identity
    name: BilingualField = Field(..., description="Bilingual product title")
    description: BilingualField = Field(..., description="Bilingual rich product description")
    
    # Fashion Attributes (Bilingual)
    color: BilingualField = Field(..., description="Bilingual color description")
    material: BilingualField = Field(..., description="Bilingual material composition")
    fit: BilingualField = Field(..., description="Bilingual fit and sizing details")
    mood: BilingualField = Field(..., description="Bilingual aesthetic mood (e.g., Vibrant/Vibráló)")
    
    # Pricing
    pricing: List[LuxuryPricing] = Field(default_factory=list, description="List of prices in different currencies")
    
    # Brand Markers & Luxury Standards
    style_markers: List[str] = Field(
        default_factory=lambda: ["Enjoy life in colours"], 
        description="Brand-specific style and value markers"
    )
    is_premium: bool = Field(default=True, description="Flag for premium quality verification")
    
    # Metadata for Luxury Systems
    metadata: Dict[str, str] = Field(
        default_factory=dict, 
        description="Additional technical metadata for luxury fashion standards"
    )
    
    # System fields
    harvest_url: Optional[str] = Field(None, description="Source URL where the product was found")
    created_at: Optional[str] = Field(None, description="ISO timestamp of creation")

class ViktoriaProductBatch(BaseModel):
    """Batch container for multiple ViktoriaProduct instances."""
    items: List[ViktoriaProduct]
    count: int
    source_system: str = Field(default="BAS-Viktoria-Scraper")
