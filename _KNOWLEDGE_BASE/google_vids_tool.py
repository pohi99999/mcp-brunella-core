from googleapiclient.discovery import build
import os
import sys
import codecs

# Kimenet kódolásának beállítása UTF-8-ra
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)

def get_video_info(video_id):
    api_key = os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        return "Hiba: A YOUTUBE_API_KEY környezeti változó nincs beállítva."

    try:
        youtube = build('youtube', 'v3', developerKey=api_key)

        request = youtube.videos().list(
            part='snippet',
            id=video_id
        )
        response = request.execute()

        if not response.get('items'):
            return f"Hiba: Nem található videó a következő azonosítóval: {video_id}"

        # A releváns adatok kinyerése a JSON válaszból
        snippet = response['items'][0]['snippet']
        video_details = {
            'title': snippet.get('title'),
            'description': snippet.get('description'),
            'tags': snippet.get('tags')
        }
        return video_details

    except Exception as e:
        return f"Hiba történt az API hívás során: {e}"

if __name__ == '__main__':
    video_id_to_test = 'dQw4w9WgXcQ' # Rick Astley - Never Gonna Give You Up
    
    # A környezeti változó beállítása a teszthez
    os.environ['YOUTUBE_API_KEY'] = 'AIzaSyB9q0bGk5zPxQn_jly9QS6RXT8L6rMKtU0'
    
    video_info = get_video_info(video_id_to_test)
    
    if isinstance(video_info, dict):
        print(f"Videó címe: {video_info.get('title')}")
        print("--- Leírás ---")
        print(video_info.get('description'))
        print("--- Címkék ---")
        print(video_info.get('tags'))
    else:
        print(video_info)