#!/usr/bin/env python3
"""Parse GPX file and generate a MapLibre HTML map."""

import xml.etree.ElementTree as ET
import json

GPX_PATH = "/Users/johannesstensson/rundloop/mina rundor/01-runkeeper-data-export-34351903-2026-03-27-155918/2014-08-11-170439.gpx"
OUT_PATH = "/Users/johannesstensson/rundloop/gnisvärd-loop.html"

NS = {"gpx": "http://www.topografix.com/GPX/1/1"}

tree = ET.parse(GPX_PATH)
root = tree.getroot()

coords = []
for trkpt in root.findall(".//gpx:trkpt", NS):
    lat = float(trkpt.get("lat"))
    lng = float(trkpt.get("lon"))
    coords.append([lng, lat])

print(f"Parsed {len(coords)} trackpoints")

lngs = [c[0] for c in coords]
lats = [c[1] for c in coords]
bounds = [[min(lngs), min(lats)], [max(lngs), max(lats)]]
start = coords[0]

coords_json = json.dumps(coords)
bounds_json = json.dumps(bounds)
start_json = json.dumps(start)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gnisvärd-loopen</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
  body {{ margin: 0; padding: 0; }}
  #map {{ position: absolute; top: 0; bottom: 0; width: 100%; }}
  .title-overlay {{
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
    background: rgba(255,255,255,0.92);
    padding: 10px 18px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }}
</style>
</head>
<body>
<div class="title-overlay">Gnisv&auml;rd-loopen &mdash; 4.3 km</div>
<div id="map"></div>
<script>
const coords = {coords_json};
const bounds = {bounds_json};
const start = {start_json};

const map = new maplibregl.Map({{
  container: 'map',
  style: {{
    version: 8,
    sources: {{
      osm: {{
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      }}
    }},
    layers: [{{
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19
    }}]
  }}
}});

map.on('load', () => {{
  map.fitBounds(bounds, {{ padding: 60 }});

  map.addSource('track', {{
    type: 'geojson',
    data: {{
      type: 'Feature',
      geometry: {{
        type: 'LineString',
        coordinates: coords
      }}
    }}
  }});

  map.addLayer({{
    id: 'track-line',
    type: 'line',
    source: 'track',
    paint: {{
      'line-color': '#2563eb',
      'line-width': 3
    }}
  }});

  map.addSource('start-point', {{
    type: 'geojson',
    data: {{
      type: 'Feature',
      geometry: {{
        type: 'Point',
        coordinates: start
      }}
    }}
  }});

  map.addLayer({{
    id: 'start-circle',
    type: 'circle',
    source: 'start-point',
    paint: {{
      'circle-radius': 8,
      'circle-color': '#22c55e',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2
    }}
  }});
}});
</script>
</body>
</html>
"""

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Output: {OUT_PATH}")
