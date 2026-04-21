import json
import sys


def main() -> None:
    raw = sys.stdin.read().strip()
    envelope = json.loads(raw) if raw else {'command': 'probe', 'payload': {}}
    command = envelope.get('command', 'probe')
    payload = envelope.get('payload', {})
    response = {
        'success': True,
        'command': command,
        'data': {
            'mock': True,
            'echo': payload,
            'jobId': 'mock-render-job' if command == 'queue_render' else None,
            'resolveReachable': True,
            'projectManagerReachable': True,
            'projects': ['MockFashionPromo'],
        },
        'warnings': ['resolve-mock'],
        'error': None,
    }
    print(json.dumps(response))


if __name__ == '__main__':
    main()
