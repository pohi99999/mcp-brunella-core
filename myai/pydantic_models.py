from __future__ import annotations

from typing import Any, Dict, List, Tuple, Type
from pydantic import BaseModel, Field, ValidationError, create_model


class ExtractionSchema(BaseModel):
    """Wrapper for JSON-schema based extraction."""

    name: str = Field(default="DynamicExtraction")
    schema: Dict[str, Any]


class ExtractionResult(BaseModel):
    """Validated extraction output + raw model output."""

    data: Dict[str, Any]
    raw_output: str


def _map_json_schema_to_type(schema: Dict[str, Any], name_hint: str) -> Tuple[Type[Any], Any]:
    schema_type = schema.get("type", "string")
    if isinstance(schema_type, list):
        schema_type = next((t for t in schema_type if t != "null"), "string")

    if schema_type == "string":
        return str, None
    if schema_type == "number":
        return float, None
    if schema_type == "integer":
        return int, None
    if schema_type == "boolean":
        return bool, None
    if schema_type == "array":
        item_schema = schema.get("items", {"type": "string"})
        item_type, _ = _map_json_schema_to_type(item_schema, f"{name_hint}Item")
        return List[item_type], None  # type: ignore[valid-type]
    if schema_type == "object":
        properties = schema.get("properties", {})
        required = set(schema.get("required", []))
        fields: Dict[str, Tuple[Type[Any], Any]] = {}
        for prop_name, prop_schema in properties.items():
            prop_type, _ = _map_json_schema_to_type(prop_schema, f"{name_hint}{prop_name.capitalize()}")
            default = ... if prop_name in required else None
            fields[prop_name] = (prop_type, default)
        nested_model = create_model(f"{name_hint}Model", **fields)
        return nested_model, None

    return Dict[str, Any], None


def build_model_from_json_schema(schema: Dict[str, Any], name: str = "DynamicExtraction") -> Type[BaseModel]:
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))
    fields: Dict[str, Tuple[Type[Any], Any]] = {}
    for prop_name, prop_schema in properties.items():
        prop_type, _ = _map_json_schema_to_type(prop_schema, f"{name}{prop_name.capitalize()}")
        default = ... if prop_name in required else None
        fields[prop_name] = (prop_type, default)
    return create_model(name, **fields)


def validate_with_schema(schema: Dict[str, Any], data: Dict[str, Any], name: str = "DynamicExtraction") -> Dict[str, Any]:
    model = build_model_from_json_schema(schema, name=name)
    validated = model.model_validate(data)
    return validated.model_dump()
