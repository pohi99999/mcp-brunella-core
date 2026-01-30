import os
import googlemaps

def find_route(origin, destination):
    # A kulcsot környezeti változóból olvasd be
    gmaps = googlemaps.Client(key=os.environ['Maps_API_KEY'])
    directions_result = gmaps.directions(origin, destination, mode="driving")
    return directions_result

if __name__ == "__main__":
    os.environ['Maps_API_KEY'] = 'AIzaSyC34rqDXxQ4wGjSm2izJQ0Qr1Q4vlS1g2k'
    result = find_route(origin="budapest", destination="debrecen")
    print(result)