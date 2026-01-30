#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Brunella Automatizációs Rendszer - Webhook Szerver
Flask alapú webhook endpoint a Google Apps Script integrációhoz
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from functools import wraps
import secrets

# Google API imports
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Konfiguráció
app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

# Logging beállítása
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Környezeti változók
WEBHOOK_TOKEN = os.environ.get('WEBHOOK_TOKEN', 'default-dev-token-change-me')
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
PARENT_FOLDER_ID = os.environ.get('PARENT_FOLDER_ID', '1pr64VuvStaWAVhlmWaXhAhQP-U6Qc3lV')

# Google API scopes
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/gmail.modify'
]

# Globális változók a Google API szolgáltatásokhoz
sheets_service = None
drive_service = None
tasks_service = None

def init_google_services():
    """Google API szolgáltatások inicializálása"""
    global sheets_service, drive_service, tasks_service
    
    try:
        if GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
            credentials = service_account.Credentials.from_service_account_file(
                GOOGLE_APPLICATION_CREDENTIALS, scopes=SCOPES
            )
            
            sheets_service = build('sheets', 'v4', credentials=credentials)
            drive_service = build('drive', 'v3', credentials=credentials)
            tasks_service = build('tasks', 'v1', credentials=credentials)
            
            logger.info("Google API szolgáltatások sikeresen inicializálva")
            return True
        else:
            logger.warning("Google Service Account credentials nem találhatók")
            return False
            
    except Exception as e:
        logger.error(f"Google API inicializálási hiba: {e}")
        return False

def require_auth(f):
    """Decorator a webhook hitelesítéshez"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Hiányzó Authorization header'}), 401
            
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Érvénytelen Authorization formátum'}), 401
            
        token = auth_header.split(' ')[1]
        
        if token != WEBHOOK_TOKEN:
            return jsonify({'error': 'Érvénytelen token'}), 401
            
        return f(*args, **kwargs)
    return decorated_function

@app.route('/health', methods=['GET'])
def health_check():
    """Egészségügyi ellenőrzés endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'sheets': sheets_service is not None,
            'drive': drive_service is not None,
            'tasks': tasks_service is not None
        }
    })

@app.route('/execute-workflow', methods=['POST'])
@require_auth
def execute_workflow():
    """Fő webhook endpoint a munkafolyamatok végrehajtásához"""
    try:
        # Request validálás
        if not request.is_json:
            return jsonify({'error': 'JSON tartalom szükséges'}), 400
            
        data = request.get_json()
        
        if 'task' not in data:
            return jsonify({'error': 'Hiányzó task adatok'}), 400
            
        task = data['task']
        required_fields = ['row', 'description', 'projectType', 'spreadsheetId']
        
        for field in required_fields:
            if field not in task:
                return jsonify({'error': f'Hiányzó mező: {field}'}), 400
        
        logger.info(f"Munkafolyamat indítása: {task['projectType']} - {task['description'][:50]}...")
        
        # Munkafolyamat végrehajtása
        result = orchestrate_workflow(task)
        
        # Státusz frissítése a Google Sheets-ben
        update_sheet_status(task, result)
        
        return jsonify({
            'status': 'success',
            'message': result.get('message', 'Munkafolyamat sikeresen végrehajtva'),
            'result_url': result.get('result_url'),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Webhook hiba: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

def orchestrate_workflow(task):
    """Központi munkafolyamat vezénylő"""
    project_type = task['projectType']
    description = task['description']
    
    logger.info(f"Munkafolyamat vezénylése: {project_type}")
    
    try:
        if project_type in ["Ingatlan Értékesítés - Üllő", "Ingatlan Értékesítés - Zalaszabar"]:
            return handle_real_estate_project(task)
            
        elif project_type == "Pályázat - Pohánka És Társa":
            return handle_grant_project(task)
            
        elif project_type == "Marketing Finomhangolás":
            return handle_marketing_project(task)
            
        elif project_type == "Kutatás":
            return handle_research_project(task)
            
        else:
            raise ValueError(f"Ismeretlen projekt típus: {project_type}")
            
    except Exception as e:
        logger.error(f"Munkafolyamat hiba: {e}")
        raise

def handle_real_estate_project(task):
    """Ingatlan projekt kezelése"""
    logger.info("Ingatlan projekt feldolgozása...")
    
    # Drive mappa létrehozása
    folder_url = create_drive_folder(task['projectType'], task['description'])
    
    # Google Tasks feladat létrehozása
    task_url = create_google_task(
        title=f"Ingatlan projekt: {task['description'][:50]}",
        notes=f"Projekt típus: {task['projectType']}\nLeírás: {task['description']}\nMappa: {folder_url}"
    )
    
    return {
        'message': 'Ingatlan projekt mappa és feladat létrehozva',
        'result_url': folder_url,
        'task_url': task_url
    }

def handle_grant_project(task):
    """Pályázat projekt kezelése"""
    logger.info("Pályázat projekt feldolgozása...")
    
    # Drive mappa létrehozása speciális struktúrával
    folder_url = create_drive_folder(task['projectType'], task['description'])
    
    # Almappák létrehozása
    if folder_url and drive_service:
        folder_id = extract_folder_id_from_url(folder_url)
        if folder_id:
            create_subfolders(folder_id, [
                "Dokumentumok",
                "Költségvetés", 
                "Kommunikáció",
                "Jelentések"
            ])
    
    return {
        'message': 'Pályázat projekt struktúra létrehozva',
        'result_url': folder_url
    }

def handle_marketing_project(task):
    """Marketing finomhangolás kezelése"""
    logger.info("Marketing projekt feldolgozása...")
    
    # Itt hívnánk meg a Gemini/Brunella API-t
    # Egyelőre szimulált válasz
    
    return {
        'message': 'Marketing finomhangolás elindítva (szimulált)',
        'result_url': 'https://example.com/marketing-result'
    }

def handle_research_project(task):
    """Kutatási projekt kezelése"""
    logger.info("Kutatási projekt feldolgozása...")
    
    # Itt hívnánk meg a Gemini/Brunella kutatási ügynököt
    # Egyelőre szimulált válasz
    
    return {
        'message': 'Kutatási projekt elindítva (szimulált)',
        'result_url': 'https://example.com/research-result'
    }

def create_drive_folder(project_type, description):
    """Google Drive mappa létrehozása"""
    if not drive_service:
        logger.error("Drive szolgáltatás nem elérhető")
        return None
        
    try:
        # Mappa név generálása
        date_str = datetime.now().strftime("%Y-%m-%d")
        clean_description = description[:30].replace('/', '-').replace('\\', '-')
        folder_name = f"{date_str}_{project_type}_{clean_description}"
        
        # Mappa létrehozása
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [PARENT_FOLDER_ID]
        }
        
        folder = drive_service.files().create(body=folder_metadata, fields='id,webViewLink').execute()
        
        logger.info(f"Drive mappa létrehozva: {folder_name}")
        return folder.get('webViewLink')
        
    except HttpError as e:
        logger.error(f"Drive mappa létrehozási hiba: {e}")
        return None

def create_subfolders(parent_folder_id, subfolder_names):
    """Almappák létrehozása"""
    if not drive_service:
        return
        
    for name in subfolder_names:
        try:
            folder_metadata = {
                'name': name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            
            drive_service.files().create(body=folder_metadata).execute()
            logger.info(f"Almappa létrehozva: {name}")
            
        except HttpError as e:
            logger.error(f"Almappa létrehozási hiba ({name}): {e}")

def create_google_task(title, notes=""):
    """Google Tasks feladat létrehozása"""
    if not tasks_service:
        logger.error("Tasks szolgáltatás nem elérhető")
        return None
        
    try:
        # Alapértelmezett tasklist lekérése
        tasklists = tasks_service.tasklists().list().execute()
        if not tasklists.get('items'):
            logger.error("Nincs elérhető tasklist")
            return None
            
        tasklist_id = tasklists['items'][0]['id']
        
        # Feladat létrehozása
        task_body = {
            'title': title,
            'notes': notes,
            'status': 'needsAction'
        }
        
        task = tasks_service.tasks().insert(tasklist=tasklist_id, body=task_body).execute()
        
        logger.info(f"Google Task létrehozva: {title}")
        return f"https://tasks.google.com/task/{task['id']}"
        
    except HttpError as e:
        logger.error(f"Google Task létrehozási hiba: {e}")
        return None

def update_sheet_status(task, result):
    """Google Sheets státusz frissítése"""
    if not sheets_service:
        logger.error("Sheets szolgáltatás nem elérhető")
        return
        
    try:
        spreadsheet_id = task['spreadsheetId']
        row = task['row']
        
        # Státusz frissítése
        status_range = f"Vezérlőpult!C{row}"
        status_value = result.get('message', 'Befejezve')
        
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=status_range,
            valueInputOption='RAW',
            body={'values': [[status_value]]}
        ).execute()
        
        # Eredmény URL frissítése, ha van
        if result.get('result_url'):
            result_range = f"Vezérlőpult!E{row}"
            sheets_service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=result_range,
                valueInputOption='RAW',
                body={'values': [[result.get('result_url')]]}
            ).execute()
        
        logger.info(f"Sheet státusz frissítve: sor {row}")
        
    except HttpError as e:
        logger.error(f"Sheet frissítési hiba: {e}")

def extract_folder_id_from_url(url):
    """Drive URL-ből folder ID kinyerése"""
    try:
        if '/folders/' in url:
            return url.split('/folders/')[1].split('?')[0]
    except:
        pass
    return None

if __name__ == '__main__':
    # Google szolgáltatások inicializálása
    init_google_services()
    
    # Szerver indítása
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
