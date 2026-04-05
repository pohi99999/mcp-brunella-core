import pytest

from myai.clients.szamlazz_hu_client import send_invoice_multipart


def test_send_invoice_multipart_accepts_bytes_and_metadata():
    sample = b'<Invoice></Invoice>'
    metadata = {'invoice_number': 'TEST-1'}
    res = send_invoice_multipart(sample, metadata)
    assert isinstance(res, dict)
    assert res.get('status') == 'stubbed'
    assert res.get('length') == len(sample)
