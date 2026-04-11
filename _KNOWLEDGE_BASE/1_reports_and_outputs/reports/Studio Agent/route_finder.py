import os
import googlemaps

def find_route(origin, destination):
    # A kulcsot környezeti változóból olvasd be
    gmaps = googlemaps.Client(key=os.environ['Maps_API_KEY'])
    directions_result = gmaps.directions(origin, destination, mode="driving")
    return directions_result

if __name__ == "__main__":
    os.environ['Maps_API_KEY'] = 'AIzaSy_REDACTED'
    result = find_route(origin="budapest", destination="debrecen")
    print(result)