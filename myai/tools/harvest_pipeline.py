"""
Harvest Pipeline - End-to-End Automation

Complete pipeline: Harvest → Refine → Integrate

This wrapper script orchestrates the full knowledge acquisition workflow:
1. Run tech_harvester.py (scrape sources)
2. Run knowledge_integrator.py (refine + integrate)
3. Report summary

Author: Claude Code (Anthropic)
Created: 2026-02-13
Track: TR-20260212-TECH-HAR
"""

import asyncio
import json
import logging
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional


# ════════════════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ════════════════════════════════════════════════════════════════════════════

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configure logging for Harvest Pipeline."""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    log_file = log_dir / "harvest_pipeline.log"

    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler()
        ]
    )

    return logging.getLogger("HarvestPipeline")


# ════════════════════════════════════════════════════════════════════════════
# PIPELINE CLASS
# ════════════════════════════════════════════════════════════════════════════

class HarvestPipeline:
    """
    End-to-end harvest pipeline orchestrator.

    Workflow:
    1. Run tech_harvester.py (async, Playwright/Browser-Use)
    2. Find latest harvest results JSON
    3. Run knowledge_integrator.py (refine + LanceDB + Golden Dataset)
    4. Report summary
    """

    def __init__(
        self,
        harvest_mode: str = "playwright",
        sources_config: str = "myai/config/sources.json",
        ollama_url: str = "http://localhost:11434",
        lancedb_path: str = "data/brunella_lancedb",
        logger: Optional[logging.Logger] = None
    ):
        self.harvest_mode = harvest_mode
        self.sources_config = sources_config
        self.ollama_url = ollama_url
        self.lancedb_path = lancedb_path
        self.logger = logger or logging.getLogger("HarvestPipeline")

        self.harvest_output_file: Optional[Path] = None
        self.summary: Dict[str, Any] = {
            "start_time": None,
            "end_time": None,
            "duration_seconds": 0,
            "harvest_status": None,
            "integration_status": None,
            "total_items_harvested": 0,
            "total_items_integrated": 0,
            "lancedb_inserted": 0,
            "golden_dataset_appended": 0,
        }

    async def run_harvest(self) -> bool:
        """
        Run tech_harvester.py subprocess.

        Returns:
            True if successful, False otherwise
        """
        self.logger.info("=" * 80)
        self.logger.info("PHASE 1: HARVESTING")
        self.logger.info("=" * 80)

        cmd = [
            sys.executable,
            "myai/agents/tech_harvester.py",
            "--mode", self.harvest_mode,
            "--config", self.sources_config,
        ]

        self.logger.info(f"Command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                self.logger.info("Harvest completed successfully")

                # Parse output to find harvest file
                output = stdout.decode('utf-8', errors='ignore')
                self._extract_harvest_file_from_output(output)

                self.summary["harvest_status"] = "success"
                return True
            else:
                self.logger.error(f"Harvest failed with exit code {process.returncode}")
                self.logger.error(stderr.decode('utf-8', errors='ignore'))
                self.summary["harvest_status"] = "failed"
                return False

        except Exception as e:
            self.logger.exception(f"Harvest error: {str(e)}")
            self.summary["harvest_status"] = "error"
            return False

    def _extract_harvest_file_from_output(self, output: str):
        """Extract harvest output file path from subprocess output."""
        # Look for "Output: temp/harvest_results/harvest_results_*.json"
        for line in output.split("\n"):
            if "Output:" in line and "harvest_results" in line:
                # Extract path
                parts = line.split("Output:")
                if len(parts) > 1:
                    filepath = parts[1].strip()
                    self.harvest_output_file = Path(filepath)
                    self.logger.info(f"Found harvest output: {self.harvest_output_file}")
                    return

        # Fallback: find latest file in temp/harvest_results/
        results_dir = Path("temp/harvest_results")
        if results_dir.exists():
            files = sorted(results_dir.glob("harvest_results_*.json"), reverse=True)
            if files:
                self.harvest_output_file = files[0]
                self.logger.info(f"Using latest harvest file: {self.harvest_output_file}")

    def find_latest_harvest_file(self) -> Optional[Path]:
        """Find the most recent harvest results file."""
        results_dir = Path("temp/harvest_results")

        if not results_dir.exists():
            self.logger.error(f"Harvest results directory not found: {results_dir}")
            return None

        files = sorted(results_dir.glob("harvest_results_*.json"), reverse=True)

        if not files:
            self.logger.error("No harvest results files found")
            return None

        latest = files[0]
        self.logger.info(f"Latest harvest file: {latest}")

        return latest

    def run_integration(self, harvest_file: Path) -> bool:
        """
        Run knowledge_integrator.py subprocess.

        Returns:
            True if successful, False otherwise
        """
        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("PHASE 2: INTEGRATION (Refine + LanceDB + Golden Dataset)")
        self.logger.info("=" * 80)

        cmd = [
            sys.executable,
            "myai/tools/knowledge_integrator.py",
            str(harvest_file),
            "--ollama-url", self.ollama_url,
            "--lancedb-path", self.lancedb_path,
        ]

        self.logger.info(f"Command: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=600  # 10 minute timeout
            )

            if result.returncode == 0:
                self.logger.info("Integration completed successfully")

                # Parse integration stats from output
                self._extract_integration_stats_from_output(result.stdout)

                self.summary["integration_status"] = "success"
                return True
            else:
                self.logger.error(f"Integration failed with exit code {result.returncode}")
                self.logger.error(result.stderr)
                self.summary["integration_status"] = "failed"
                return False

        except subprocess.TimeoutExpired:
            self.logger.error("Integration timed out (10 minutes)")
            self.summary["integration_status"] = "timeout"
            return False
        except Exception as e:
            self.logger.exception(f"Integration error: {str(e)}")
            self.summary["integration_status"] = "error"
            return False

    def _extract_integration_stats_from_output(self, output: str):
        """Extract statistics from knowledge_integrator output."""
        for line in output.split("\n"):
            if "LanceDB inserted:" in line:
                try:
                    count = int(line.split(":")[-1].strip())
                    self.summary["lancedb_inserted"] = count
                except:
                    pass
            elif "Golden Dataset appended:" in line:
                try:
                    count = int(line.split(":")[-1].strip())
                    self.summary["golden_dataset_appended"] = count
                except:
                    pass
            elif "Total items:" in line:
                try:
                    count = int(line.split(":")[-1].strip())
                    self.summary["total_items_harvested"] = count
                except:
                    pass

    async def run_pipeline(self) -> Dict[str, Any]:
        """
        Run complete pipeline: Harvest → Integrate → Report

        Returns:
            Summary dictionary
        """
        self.logger.info("+" + "=" * 78 + "+")
        self.logger.info("|" + " " * 20 + "HARVEST PIPELINE STARTING" + " " * 33 + "|")
        self.logger.info("+" + "=" * 78 + "+")

        start_time = datetime.utcnow()
        self.summary["start_time"] = start_time.isoformat()

        # Phase 1: Harvest
        harvest_success = await self.run_harvest()

        if not harvest_success:
            self.logger.error("Harvest phase failed, aborting pipeline")
            self.summary["end_time"] = datetime.utcnow().isoformat()
            self.summary["duration_seconds"] = (datetime.utcnow() - start_time).total_seconds()
            return self.summary

        # Find harvest output file
        if not self.harvest_output_file:
            self.harvest_output_file = self.find_latest_harvest_file()

        if not self.harvest_output_file:
            self.logger.error("No harvest output file found, aborting pipeline")
            self.summary["end_time"] = datetime.utcnow().isoformat()
            self.summary["duration_seconds"] = (datetime.utcnow() - start_time).total_seconds()
            return self.summary

        # Load harvest file to get item count
        try:
            with open(self.harvest_output_file, "r", encoding="utf-8") as f:
                harvest_data = json.load(f)
                self.summary["total_items_harvested"] = harvest_data.get("total_items", 0)
        except:
            pass

        # Phase 2: Integration
        integration_success = self.run_integration(self.harvest_output_file)

        if integration_success:
            self.summary["total_items_integrated"] = self.summary.get("lancedb_inserted", 0)

        # Finalize summary
        end_time = datetime.utcnow()
        self.summary["end_time"] = end_time.isoformat()
        self.summary["duration_seconds"] = (end_time - start_time).total_seconds()

        # Print final summary
        self._print_final_summary()

        return self.summary

    def _print_final_summary(self):
        """Print final pipeline summary."""
        self.logger.info("")
        self.logger.info("+" + "=" * 78 + "+")
        self.logger.info("|" + " " * 20 + "HARVEST PIPELINE COMPLETED" + " " * 32 + "|")
        self.logger.info("+" + "=" * 78 + "+")
        self.logger.info("")
        self.logger.info(f"  Duration: {self.summary['duration_seconds']:.2f} seconds")
        self.logger.info(f"  Harvest Status: {self.summary['harvest_status']}")
        self.logger.info(f"  Integration Status: {self.summary['integration_status']}")
        self.logger.info("")
        self.logger.info(f"  Items Harvested: {self.summary['total_items_harvested']}")
        self.logger.info(f"  Items Integrated: {self.summary['total_items_integrated']}")
        self.logger.info(f"  LanceDB Inserted: {self.summary['lancedb_inserted']}")
        self.logger.info(f"  Golden Dataset Appended: {self.summary['golden_dataset_appended']}")
        self.logger.info("")
        self.logger.info("+" + "=" * 78 + "+")


# ════════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════

async def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Harvest Pipeline - Complete Knowledge Acquisition Workflow")
    parser.add_argument("--mode", choices=["browser-use", "playwright"], default="playwright",
                        help="Harvesting mode (default: playwright)")
    parser.add_argument("--config", default="myai/config/sources.json",
                        help="Sources config file")
    parser.add_argument("--ollama-url", default="http://localhost:11434",
                        help="Ollama API URL")
    parser.add_argument("--lancedb-path", default="data/brunella_lancedb",
                        help="LanceDB path")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        help="Logging level")

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.log_level)

    # Create pipeline
    pipeline = HarvestPipeline(
        harvest_mode=args.mode,
        sources_config=args.config,
        ollama_url=args.ollama_url,
        lancedb_path=args.lancedb_path,
        logger=logger
    )

    # Run pipeline
    summary = await pipeline.run_pipeline()

    # Exit code based on status
    if summary["harvest_status"] == "success" and summary["integration_status"] == "success":
        return 0
    else:
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
