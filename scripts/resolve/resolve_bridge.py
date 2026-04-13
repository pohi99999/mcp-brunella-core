import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

KNOWN_API_PATHS = [
    os.environ.get('DAVINCI_RESOLVE_SCRIPT_API_PATH', ''),
    'C:/ProgramData/Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting',
    '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting',
    '/opt/resolve/Developer/Scripting',
]
KNOWN_MODULE_PATHS = [
    os.environ.get('DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES', ''),
    'C:/ProgramData/Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting/Modules',
    '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules',
    '/opt/resolve/Developer/Scripting/Modules',
]


def _extend_sys_path() -> List[str]:
    appended = []
    for raw in KNOWN_API_PATHS + KNOWN_MODULE_PATHS:
        if not raw:
            continue
        candidate = Path(raw)
        if candidate.exists() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))
            appended.append(str(candidate))
    return appended


def _load_payload() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {'command': 'probe', 'payload': {}}
    return json.loads(raw)


def _respond(success: bool, command: str, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None, warnings: Optional[List[str]] = None) -> None:
    print(json.dumps({
        'success': success,
        'command': command,
        'data': data or {},
        'error': error,
        'warnings': warnings or [],
    }))


def _load_resolve_module() -> Tuple[Any, List[str]]:
    warnings = []
    appended = _extend_sys_path()
    if appended:
      warnings.append(f'extended_sys_path:{len(appended)}')
    try:
        import DaVinciResolveScript  # type: ignore
        return DaVinciResolveScript, warnings
    except Exception as exc:
        warnings.append(f'import_failed:{exc}')
        return None, warnings


def _get_resolve(resolve_module: Any) -> Any:
    if resolve_module is None:
        return None
    try:
        return resolve_module.scriptapp('Resolve')
    except Exception:
        return None


def _get_project_manager(resolve_app: Any) -> Any:
    return resolve_app.GetProjectManager() if resolve_app else None


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def cmd_probe(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    resolve_module, warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    projects = []
    if project_manager:
        try:
            projects = _as_list(project_manager.GetProjectListInCurrentFolder())
        except Exception as exc:
            warnings.append(f'project_list_failed:{exc}')
    return True, {
        'resolveReachable': bool(resolve_app),
        'projectManagerReachable': bool(project_manager),
        'projects': projects,
        'defaultProjectName': os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', 'BrunellaStudio'),
    }, None if resolve_app else 'DaVinci Resolve scripting API is not reachable.', warnings


def _load_or_create_project(project_manager: Any, project_name: str) -> Tuple[Any, List[str]]:
    warnings = []
    if not project_manager:
        return None, ['project_manager_missing']
    project = None
    try:
        project = project_manager.LoadProject(project_name)
    except Exception as exc:
        warnings.append(f'load_project_failed:{exc}')
    if not project:
        try:
            project = project_manager.CreateProject(project_name)
        except Exception as exc:
            warnings.append(f'create_project_failed:{exc}')
    return project, warnings


def cmd_create_or_open_project(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    resolve_module, warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project_name = str(payload.get('projectName') or os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', 'BrunellaStudio'))
    project, project_warnings = _load_or_create_project(project_manager, project_name)
    warnings.extend(project_warnings)
    success = project is not None
    return success, {'projectName': project_name, 'opened': success}, None if success else 'Unable to open or create Resolve project.', warnings


def cmd_list_projects(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    success, data, error, warnings = cmd_probe(payload)
    return success, {'projects': data.get('projects', [])}, error, warnings


def _get_media_pool(project: Any) -> Any:
    if not project:
        return None
    try:
        return project.GetMediaPool()
    except Exception:
        return None


def cmd_import_media(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    success, data, error, warnings = cmd_create_or_open_project(payload)
    if not success:
        return success, data, error, warnings
    resolve_module, extra_warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project = project_manager.LoadProject(data['projectName']) if project_manager else None
    media_pool = _get_media_pool(project)
    paths = [str(Path(item)) for item in payload.get('paths', [])]
    imported = []
    if media_pool and hasattr(media_pool, 'ImportMedia'):
        try:
            imported = _as_list(media_pool.ImportMedia(paths))
        except Exception as exc:
            warnings.append(f'import_media_failed:{exc}')
    warnings.extend(extra_warnings)
    return bool(imported), {'requested': paths, 'importedCount': len(imported)}, None if imported else 'Resolve could not import the requested media.', warnings


def cmd_create_bins(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    success, data, error, warnings = cmd_create_or_open_project(payload)
    if not success:
        return success, data, error, warnings
    resolve_module, extra_warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project = project_manager.LoadProject(data['projectName']) if project_manager else None
    media_pool = _get_media_pool(project)
    root_folder = media_pool.GetRootFolder() if media_pool and hasattr(media_pool, 'GetRootFolder') else None
    created = []
    for bin_name in payload.get('bins', []):
        if media_pool and root_folder and hasattr(media_pool, 'AddSubFolder'):
            try:
                folder = media_pool.AddSubFolder(root_folder, str(bin_name))
                if folder is not None:
                    created.append(str(bin_name))
            except Exception as exc:
                warnings.append(f'create_bin_failed:{bin_name}:{exc}')
    warnings.extend(extra_warnings)
    return True, {'createdBins': created}, None if created else 'No bins were created.', warnings


def cmd_create_timeline(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    success, data, error, warnings = cmd_create_or_open_project(payload)
    if not success:
        return success, data, error, warnings
    resolve_module, extra_warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project = project_manager.LoadProject(data['projectName']) if project_manager else None
    media_pool = _get_media_pool(project)
    timeline_name = str(payload.get('timelineName') or data['projectName'])
    created = False
    if media_pool and hasattr(media_pool, 'CreateEmptyTimeline'):
        try:
            created = media_pool.CreateEmptyTimeline(timeline_name) is not None
        except Exception as exc:
            warnings.append(f'create_timeline_failed:{exc}')
    warnings.extend(extra_warnings)
    return created, {'timelineName': timeline_name}, None if created else 'Unable to create empty timeline.', warnings


def cmd_append_clips(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    success, data, error, warnings = cmd_create_or_open_project(payload)
    if not success:
        return success, data, error, warnings
    resolve_module, extra_warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project = project_manager.LoadProject(data['projectName']) if project_manager else None
    media_pool = _get_media_pool(project)
    appended = False
    if media_pool and hasattr(media_pool, 'AppendToTimeline'):
        try:
            appended = bool(media_pool.AppendToTimeline(payload.get('clips', [])))
        except Exception as exc:
            warnings.append(f'append_failed:{exc}')
    warnings.extend(extra_warnings)
    return appended, {'clipCount': len(payload.get('clips', []))}, None if appended else 'Unable to append clips to Resolve timeline.', warnings


def cmd_add_markers(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    resolve_module, warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project_name = str(payload.get('projectName') or os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', 'BrunellaStudio'))
    project = project_manager.LoadProject(project_name) if project_manager else None
    timeline = project.GetCurrentTimeline() if project and hasattr(project, 'GetCurrentTimeline') else None
    added = 0
    if timeline and hasattr(timeline, 'AddMarker'):
        for marker in payload.get('markers', []):
            try:
                if timeline.AddMarker(float(marker.get('frameId', 0)), marker.get('color', 'Blue'), marker.get('name', 'Marker'), marker.get('note', ''), float(marker.get('duration', 1)), ''):
                    added += 1
            except Exception as exc:
                warnings.append(f'marker_failed:{exc}')
    return added > 0, {'markerCount': added}, None if added else 'Unable to add markers.', warnings


def cmd_queue_render(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    resolve_module, warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project_name = str(payload.get('projectName') or os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', 'BrunellaStudio'))
    project = project_manager.LoadProject(project_name) if project_manager else None
    if not project:
        return False, {}, 'Resolve project not available for render queue.', warnings
    try:
        if hasattr(project, 'SetRenderSettings'):
            project.SetRenderSettings(payload.get('renderSettings', {}))
        job_id = project.AddRenderJob() if hasattr(project, 'AddRenderJob') else None
        return job_id is not None, {'jobId': job_id}, None if job_id else 'AddRenderJob returned no job id.', warnings
    except Exception as exc:
        return False, {}, f'Unable to queue render: {exc}', warnings


def cmd_start_render(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Optional[str], List[str]]:
    resolve_module, warnings = _load_resolve_module()
    resolve_app = _get_resolve(resolve_module)
    project_manager = _get_project_manager(resolve_app)
    project_name = str(payload.get('projectName') or os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', 'BrunellaStudio'))
    project = project_manager.LoadProject(project_name) if project_manager else None
    if not project or not hasattr(project, 'StartRendering'):
        return False, {}, 'Resolve project cannot start rendering.', warnings
    try:
        job_ids = payload.get('jobIds', [])
        result = project.StartRendering(job_ids) if job_ids else project.StartRendering()
        return bool(result), {'started': bool(result), 'jobIds': job_ids}, None if result else 'Resolve rejected StartRendering.', warnings
    except Exception as exc:
        return False, {}, f'Unable to start render: {exc}', warnings


COMMANDS = {
    'probe': cmd_probe,
    'list_projects': cmd_list_projects,
    'create_or_open_project': cmd_create_or_open_project,
    'import_media': cmd_import_media,
    'create_bins': cmd_create_bins,
    'create_timeline': cmd_create_timeline,
    'append_clips': cmd_append_clips,
    'add_markers': cmd_add_markers,
    'queue_render': cmd_queue_render,
    'start_render': cmd_start_render,
}


def main() -> None:
    envelope = _load_payload()
    command = str(envelope.get('command', 'probe'))
    payload = envelope.get('payload', {}) or {}
    handler = COMMANDS.get(command)
    if handler is None:
        _respond(False, command, error=f'Unsupported Resolve bridge command: {command}')
        return
    success, data, error, warnings = handler(payload)
    _respond(success, command, data=data, error=error, warnings=warnings)


if __name__ == '__main__':
    main()
