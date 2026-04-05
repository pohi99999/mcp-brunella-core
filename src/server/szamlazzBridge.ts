import { spawn } from 'child_process';

export interface SzamlazzSendResult {
  success: boolean;
  statusCode?: number;
  contentType?: string;
  documentType?: 'pdf' | 'text';
  responseText?: string;
  responseBase64?: string;
  error?: string;
}

interface RawSzamlazzSendResult {
  success?: boolean;
  status_code?: number;
  content_type?: string;
  document_type?: 'pdf' | 'text';
  response_text?: string;
  response_base64?: string;
  error?: string;
}

const PYTHON_SCRIPT = String.raw`
import json
import sys

from myai.clients.szamlazz_hu_client import SzamlazzHuClient


def main() -> None:
    xml_payload = sys.stdin.read()
    client = SzamlazzHuClient()

    try:
        result = client.send_invoice(xml_payload)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
`;

function getPythonExecutable(): string {
  return process.env.PYTHON || process.env.PYTHON_BIN || 'python';
}

function normalizeResult(raw: RawSzamlazzSendResult): SzamlazzSendResult {
  return {
    success: raw.success ?? false,
    statusCode: raw.status_code,
    contentType: raw.content_type,
    documentType: raw.document_type,
    responseText: raw.response_text,
    responseBase64: raw.response_base64,
    error: raw.error,
  };
}

export function sendSzamlazzInvoice(xmlPayload: string): Promise<SzamlazzSendResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(getPythonExecutable(), ['-c', PYTHON_SCRIPT], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error: Error) => {
      reject(error);
    });

    child.on('close', (code) => {
      const output = stdout.trim();
      if (!output) {
        reject(new Error(stderr.trim() || `Szamlazz bridge exited with code ${code ?? 'unknown'} without output.`));
        return;
      }

      try {
        const parsed = JSON.parse(output) as RawSzamlazzSendResult;
        resolve(normalizeResult(parsed));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new Error(`${message}${stderr.trim() ? `\n${stderr.trim()}` : ''}`));
      }
    });

    child.stdin.setDefaultEncoding('utf8');
    child.stdin.end(xmlPayload);
  });
}
