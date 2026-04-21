# myai/utils/dependency_detector.py

DEPENDENCY_MAP = {
    "tőzsde": ["yfinance", "pandas"],
    "web scraping": ["playwright", "beautifulsoup4"],
    "api": ["httpx", "aiohttp"],
    "database": ["sqlalchemy", "lancedb"],
}

def detect_dependencies(description: str):
    """
    Detects Python dependencies based on a natural language description.
    """
    detected = []
    for keyword, packages in DEPENDENCY_MAP.items():
        if keyword in description.lower():
            detected.extend(packages)
    return list(set(detected))

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        description = " ".join(sys.argv[1:])
        dependencies = detect_dependencies(description)
        print(",".join(dependencies))
