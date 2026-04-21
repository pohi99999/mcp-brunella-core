"""Document refine endpoint skeleton for Phase 3.

This module implements a simple refine_documents() function that normalizes
and returns a small summary for each incoming document. Intended for early
integration tests and local development.
"""
from typing import List, Dict, Any


def refine_documents(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    '''Lightweight document refiner used by the Phase 3 skeleton pipeline.'''
    out = []
    for d in docs:
        text = d.get('text') or ''
        out.append({'id': d.get('id', 'stub'), 'summary': text[:200], 'source': d.get('source')})
    return out


if __name__ == '__main__':
    sample = [{'id': '1', 'text': 'This is a sample invoice text extracted by the stub.', 'source': 'imap_stub'}]
    print(refine_documents(sample))
