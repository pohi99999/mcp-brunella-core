from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict


class VectorDbInterface(ABC):
    """Abstract interface for vector database operations."""

    @abstractmethod
    async def add_document(self, text: str, metadata: Dict) -> None:
        raise NotImplementedError
