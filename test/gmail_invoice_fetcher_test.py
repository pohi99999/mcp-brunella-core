from unittest.mock import mock_open, patch

from myai.gmail_invoice_fetcher import authenticate_gmail


def test_authenticate_gmail_uses_workspace_env_paths(monkeypatch):
    monkeypatch.setenv("GOOGLE_WORKSPACE_CREDENTIALS_FILE", "./credentials/google-oauth2-credentials.json")
    monkeypatch.setenv("GOOGLE_WORKSPACE_TOKEN_FILE", "./credentials/google-token.json")

    fake_creds = type(
        "FakeCreds",
        (),
        {
            "valid": True,
            "expired": False,
            "refresh_token": None,
            "to_json": lambda self: '{"access_token":"abc"}',
        },
    )()
    fake_flow = type(
        "FakeFlow",
        (),
        {"run_local_server": lambda self, port=0: fake_creds},
    )()

    with patch("myai.gmail_invoice_fetcher.os.path.exists", return_value=False), \
         patch("myai.gmail_invoice_fetcher.InstalledAppFlow.from_client_secrets_file", return_value=fake_flow) as flow_factory, \
         patch("myai.gmail_invoice_fetcher.open", mock_open()) as mocked_open, \
         patch("myai.gmail_invoice_fetcher.os.makedirs") as makedirs_mock:
        creds = authenticate_gmail()

    assert creds is fake_creds
    flow_factory.assert_called_once_with("./credentials/google-oauth2-credentials.json", ['https://www.googleapis.com/auth/gmail.readonly'])
    makedirs_mock.assert_called_once_with("./credentials", exist_ok=True)
    mocked_open.assert_called_once_with("./credentials/google-token.json", "w", encoding="utf-8")
