#!/usr/bin/env python3
"""
Egyszerű agent indító script
Használat Claude Code-ból vagy CLI-ból.

Példák:
    python run_agent.py EKR
    python run_agent.py EKR --all
    python run_agent.py EKR --keyword "iszapkotrás"
"""

import sys
import os

# Agents mappa hozzáadása a Python path-hoz
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'agents'))


def main():
    if len(sys.argv) < 2:
        print("❌ Használat: python run_agent.py AGENT_NAME [options]")
        print("\nElérhető ügynökök:")
        print("  - EKR: Elektronikus Közbeszerzési Rendszer monitoring")
        print("\nPéldák:")
        print("  python run_agent.py EKR")
        print("  python run_agent.py EKR --all")
        print("  python run_agent.py EKR --keyword 'iszapkotrás'")
        sys.exit(1)

    agent_name = sys.argv[1].upper()

    if agent_name == "EKR":
        from ekr_agent import EKRAgent

        # Parancssori argumentumok feldolgozása
        only_active = True
        custom_keywords = []
        username = None
        password = None

        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i]

            if arg == "--all":
                only_active = False
            elif arg == "--keyword" and i + 1 < len(sys.argv):
                custom_keywords.append(sys.argv[i + 1])
                i += 1
            elif arg == "--username" and i + 1 < len(sys.argv):
                username = sys.argv[i + 1]
                i += 1
            elif arg == "--password" and i + 1 < len(sys.argv):
                password = sys.argv[i + 1]
                i += 1

            i += 1

        # Agent létrehozása és futtatása
        agent = EKRAgent(
            username=username,
            password=password,
            only_active=only_active,
            custom_keywords=custom_keywords if custom_keywords else None
        )

        success = agent.run()
        sys.exit(0 if success else 1)

    else:
        print(f"❌ Ismeretlen ügynök: {agent_name}")
        print("\nElérhető ügynökök: EKR")
        sys.exit(1)


if __name__ == "__main__":
    main()
