# src/servers/automation.py - Automation MCP Module with Scheduler
import logging
from datetime import datetime
from fastmcp import FastMCP
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# Logolás beállítása
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-automation")

# APScheduler inicializálása SQLite háttértárral
jobstores = {
    'default': SQLAlchemyJobStore(url='sqlite:///scheduler.db')
}
scheduler = BackgroundScheduler(jobstores=jobstores)

# Automation modul inicializálása
mcp_automation = FastMCP("Automation Module")

def execute_reminder(message: str):
    """Az ütemező által meghívott végrehajtó függvény."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"EMLÉKEZTETŐ [{now}]: {message}")
    print(f"EMLÉKEZTETŐ [{now}]: {message}")

@mcp_automation.tool()
async def schedule_reminder(message: str, run_at: str) -> str:
    """
    Beütemez egy emlékeztető üzenetet egy adott időpontra.
    
    Args:
        message: Az emlékeztető szövege.
        run_at: Az időpont ISO formátumban (YYYY-MM-DD HH:MM:SS).
    """
    try:
        run_date = datetime.strptime(run_at, "%Y-%m-%d %H:%M:%S")
        job = scheduler.add_job(execute_reminder, 'date', run_date=run_date, args=[message])
        return f"Emlékeztető beütemezve! ID: {job.id}, Időpont: {run_at}"
    except Exception as e:
        return f"Hiba az ütemezéskor: {str(e)}"

@mcp_automation.tool()
async def list_scheduled_jobs() -> str:
    """Listázza az összes aktív ütemezett feladatot."""
    jobs = scheduler.get_jobs()
    if not jobs:
        return "Nincsenek aktív ütemezett feladatok."
    
    output = []
    for job in jobs:
        output.append(f"- ID: {job.id}, Következő futás: {job.next_run_time}")
    return "\n".join(output)

@mcp_automation.tool()
async def remove_scheduled_job(job_id: str) -> str:
    """
    Töröl egy ütemezett feladatot az azonosítója alapján.
    
    Args:
        job_id: A törlendő feladat azonosítója.
    """
    try:
        scheduler.remove_job(job_id)
        return f"Feladat ({job_id}) sikeresen törölve."
    except Exception as e:
        return f"Hiba a törléskor: {str(e)}"

@mcp_automation.tool()
async def automation_status() -> str:
    """Visszaadja az automatizációs modul állapotát."""
    status = "running" if scheduler.running else "stopped"
    return f"Automation Module is active. Scheduler status: {status}."

# Az ütemező elindítása a szerver betöltésekor
if not scheduler.running:
    scheduler.start()
    logger.info("APScheduler started.")

if __name__ == "__main__":
    mcp_automation.run(transport="stdio")