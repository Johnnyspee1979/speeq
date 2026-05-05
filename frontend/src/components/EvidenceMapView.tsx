/**
 * EvidenceMapView — GPS kaart met alle vastgelegde borgingspunten.
 *
 * Techniek: Leaflet.js geladen via CDN in een <iframe srcDoc>.
 * Geen npm install nodig — werkt puur via web.
 *
 * Elke pin:
 *   Groen   = SYNCED (cloud veilig)
 *   Oranje  = PENDING (lokaal)
 *   Rood    = FAILED
 *
 * Popup bevat: inspectionPointId + datum + weer + AI status + navigatielinks
 * Extra: tile switcher, geofence, accuracy circles, marker clustering
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { isWeb } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';
import { useProject } from '../context/ProjectContext';
import { PROJECT_LOCATION, PROJECT_RADIUS_METERS } from '../config/app';
import { supabase } from '../lib/supabase';

// ────────────────────────────────────────────────
// HTML-builder voor de Leaflet kaart
// ────────────────────────────────────────────────

// ── Supabase evidence type voor de kaart ─────────────────────────────────────
interface MapEvidence {
  id: string;
  inspection_point_id: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  timestamp: string;
  ai_status: string | null;
  sync_status: string | null;
}

function resolveCoords(e: MapEvidence): { lat: number; lng: number; acc: number } | null {
  const lat = e.latitude;
  const lng = e.longitude;
  const acc = e.gps_accuracy ?? 0;
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, acc };
}

function buildMapHtml(
  evidence: MapEvidence[],
  isDark: boolean,
  projectLat: number | null,
  projectLng: number | null,
  projectRadius: number
): string {
  type MarkerData = {
    lat: number;
    lon: number;
    id: string;
    color: string;
    label: string;
    date: string;
    ai: string;
    accuracy: number;
  };

  const markers: MarkerData[] = evidence
    .map((e) => {
      const coords = resolveCoords(e);
      if (!coords) return null;

      const color =
        e.sync_status === 'SYNCED'
          ? '#059669'
          : e.sync_status === 'FAILED'
          ? '#dc2626'
          : '#d97706';

      const aiLabel = (() => {
        const s = (e.ai_status ?? '').toUpperCase();
        if (['PASSED', 'APPROVED', 'OK'].includes(s)) return '✓ AI akkoord';
        if (['NEEDS_REVIEW', 'WARNING'].includes(s)) return '⚠ Review';
        if (['FAILED', 'REJECTED'].includes(s)) return '✗ Afgekeurd';
        return '○ Pending';
      })();

      return {
        lat: coords.lat,
        lon: coords.lng,
        id: e.inspection_point_id ?? 'onbekend',
        color,
        label: e.inspection_point_id ?? 'onbekend',
        date: e.timestamp
          ? new Date(e.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
          : '-',
        ai: aiLabel,
        accuracy: coords.acc,
      };
    })
    .filter((m): m is MarkerData => m !== null);

  // Gemiddeld centrum berekenen
  const avgLat =
    markers.length > 0
      ? markers.reduce((s, m) => s + m.lat, 0) / markers.length
      : projectLat ?? 52.3676;
  const avgLon =
    markers.length > 0
      ? markers.reduce((s, m) => s + m.lon, 0) / markers.length
      : projectLng ?? 4.904;

  const markersJson = JSON.stringify(markers);
  const hasProject = projectLat !== null && projectLng !== null;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100vh; }
    .leaflet-popup-content { font-family: -apple-system, sans-serif; font-size: 13px; }
    .popup-id { font-weight: 800; font-size: 13px; margin-bottom: 4px; color: #111; }
    .popup-row { font-size: 11px; color: #555; margin-bottom: 2px; }
    .popup-ai { margin-top: 6px; font-size: 11px; font-weight: 700; }
    #provider-bar button {
      background: white; border: none; border-radius: 8px;
      padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18); color: #333; letter-spacing: 0.01em;
      transition: all 0.15s ease;
    }
    #provider-bar button:hover { background: #f0f4ff; }
    #provider-bar button.active {
      background: #1d4ed8; color: white; box-shadow: 0 2px 8px rgba(29,78,216,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="provider-bar" style="position:absolute;bottom:30px;left:10px;z-index:1000;display:flex;gap:6px;flex-wrap:wrap;"></div>
  <script>
    // ── Bing quadkey helper ──
    function tileToQuadKey(x, y, z) {
      var quadKey = '';
      for (var i = z; i > 0; i--) {
        var digit = 0;
        var mask = 1 << (i - 1);
        if ((x & mask) !== 0) digit++;
        if ((y & mask) !== 0) digit += 2;
        quadKey += digit;
      }
      return quadKey;
    }

    var BingLayer = L.TileLayer.extend({
      getTileUrl: function(coords) {
        return 'https://ecn.t3.tiles.virtualearth.net/tiles/a' + tileToQuadKey(coords.x, coords.y, coords.z) + '.jpeg?g=1';
      }
    });

    // ── Tile providers ──
    var PROVIDERS = {
      'Modern':     { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '© CartoDB, © OpenStreetMap' },
      'Licht':      { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '© CartoDB, © OpenStreetMap' },
      'Satelliet':  { url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attribution: '© Google' },
      'Hybride':    { url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attribution: '© Google' },
      'Bing Lucht': { isBing: true, attribution: '© Microsoft Bing' }
    };

    // ── Altijd modern licht als standaard ──
    var defaultTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    var defaultAttribution = '© CartoDB, © OpenStreetMap contributors';
    var activeProvider = 'Modern';

    var markers = ${markersJson};
    var map = L.map('map').setView([${avgLat}, ${avgLon}], markers.length > 0 ? 17 : 13);

    var currentTileLayer = L.tileLayer(defaultTileUrl, {
      attribution: defaultAttribution,
      maxZoom: 20,
    }).addTo(map);

    // ── Provider bar buttons ──
    var bar = document.getElementById('provider-bar');
    var providerNames = Object.keys(PROVIDERS);

    providerNames.forEach(function(name) {
      var btn = document.createElement('button');
      btn.textContent = name;
      if (name === activeProvider) btn.classList.add('active');
      btn.addEventListener('click', function() {
        map.removeLayer(currentTileLayer);
        var provider = PROVIDERS[name];
        if (provider.isBing) {
          currentTileLayer = new BingLayer('', { attribution: provider.attribution, maxZoom: 20 });
        } else {
          currentTileLayer = L.tileLayer(provider.url, { attribution: provider.attribution, maxZoom: 20 });
        }
        currentTileLayer.addTo(map);
        bar.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
      bar.appendChild(btn);
    });

    // ── Project geofence ──
    ${hasProject ? `
    var projectLat = ${projectLat};
    var projectLng = ${projectLng};
    var projectRadius = ${projectRadius};

    L.circle([projectLat, projectLng], {
      radius: projectRadius,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.07,
      weight: 2,
      dashArray: '6,4'
    }).addTo(map);

    L.circleMarker([projectLat, projectLng], {
      radius: 8, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.8, weight: 2
    }).bindTooltip('📍 Projectlocatie').addTo(map);
    ` : ''}

    // ── Marker cluster group ──
    var clusterGroup = L.markerClusterGroup();

    markers.forEach(function(m) {
      var lat = m.lat;
      var lon = m.lon;

      var icon = L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:' + m.color + ';border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10],
      });

      var navLinks =
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
        '<a href="https://www.google.com/maps?q=' + lat + ',' + lon + '" target="_blank" ' +
        'style="background:#4285F4;color:white;padding:4px 8px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">Google Maps</a>' +
        '<a href="https://maps.apple.com/?ll=' + lat + ',' + lon + '&q=Borgingspunt" target="_blank" ' +
        'style="background:#000;color:white;padding:4px 8px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">Apple Maps</a>' +
        '<a href="https://waze.com/ul?ll=' + lat + ',' + lon + '&navigate=yes" target="_blank" ' +
        'style="background:#33CCFF;color:#000;padding:4px 8px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">Waze</a>' +
        '<a href="https://bing.com/maps/default.aspx?cp=' + lat + '~' + lon + '&lvl=17" target="_blank" ' +
        'style="background:#0078D4;color:white;padding:4px 8px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">Bing Maps</a>' +
        '</div>';

      var marker = L.marker([lat, lon], { icon })
        .bindPopup(
          '<div class="popup-id">📍 ' + m.id + '</div>' +
          '<div class="popup-row">🕐 ' + m.date + '</div>' +
          '<div class="popup-row">📡 ' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</div>' +
          '<div class="popup-ai">' + m.ai + '</div>' +
          navLinks
        );

      clusterGroup.addLayer(marker);

      // Accuracy circle
      if (m.accuracy > 0) {
        L.circle([lat, lon], {
          radius: m.accuracy,
          color: m.color,
          fillColor: m.color,
          fillOpacity: 0.06,
          weight: 1
        }).addTo(map);
      }
    });

    map.addLayer(clusterGroup);

    if (markers.length > 1) {
      var bounds = L.latLngBounds(markers.map(function(m) { return [m.lat, m.lon]; }));
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    // ── Mijn locatie knop ──────────────────────────────────────────────
    var myLocMarker = null;
    var myLocCircle = null;
    var myLocPulse  = null;
    var watchId     = null;

    var locBtn = L.control({ position: 'topright' });
    locBtn.onAdd = function() {
      var btn = L.DomUtil.create('button', '');
      btn.innerHTML = '📍 Mijn locatie';
      btn.title = 'Toon mijn huidige positie';
      btn.style.cssText = [
        'background:white','border:none','border-radius:8px',
        'padding:8px 14px','font-size:13px','font-weight:700',
        'cursor:pointer','box-shadow:0 2px 8px rgba(0,0,0,0.2)',
        'display:flex','align-items:center','gap:6px','white-space:nowrap',
        'color:#1d4ed8'
      ].join(';');

      L.DomEvent.on(btn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        if (!navigator.geolocation) {
          btn.innerHTML = '❌ Geen GPS';
          return;
        }
        btn.innerHTML = '⏳ Zoeken…';
        btn.style.color = '#6b7280';

        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }

        watchId = navigator.geolocation.watchPosition(
          function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            var acc = pos.coords.accuracy;

            // Verwijder oude lagen
            if (myLocMarker) map.removeLayer(myLocMarker);
            if (myLocCircle) map.removeLayer(myLocCircle);

            // Nauwkeurigheidscirkel (lichtblauw)
            myLocCircle = L.circle([lat, lng], {
              radius: acc,
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '4,3'
            }).addTo(map);

            // Pulserende blauwe stip
            var pulseIcon = L.divIcon({
              className: '',
              html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);animation:pulse 1.5s infinite;"></div>',
              iconSize: [16,16], iconAnchor: [8,8]
            });
            myLocMarker = L.marker([lat, lng], { icon: pulseIcon })
              .bindPopup(
                '<b>📍 Jouw locatie</b><br>' +
                'Lat: ' + lat.toFixed(6) + '<br>' +
                'Lng: ' + lng.toFixed(6) + '<br>' +
                '🎯 Nauwkeurigheid: <b>' + Math.round(acc) + ' m</b><br>' +
                (acc <= 20 ? '✅ Goed voor Wkb-bewijs' :
                 acc <= 100 ? '⚠️ Matig (WiFi-positie)' :
                 '❌ Te onnauwkeurig (IP-schatting)')
              ).addTo(map);

            map.setView([lat, lng], 17, { animate: true });

            var accLabel = acc <= 20 ? '±' + Math.round(acc) + 'm ✅' :
                           acc <= 100 ? '±' + Math.round(acc) + 'm ⚠️' :
                           '±' + Math.round(acc) + 'm ❌';
            btn.innerHTML = '📍 ' + accLabel;
            btn.style.color = acc <= 20 ? '#059669' : acc <= 100 ? '#d97706' : '#dc2626';
          },
          function(err) {
            btn.innerHTML = '❌ ' + (err.code === 1 ? 'Toegang geweigerd' : 'GPS fout');
            btn.style.color = '#dc2626';
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      });
      return btn;
    };
    locBtn.addTo(map);

    // CSS pulse animatie
    var style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0%,100%{box-shadow:0 0 0 4px rgba(37,99,235,0.3)} 50%{box-shadow:0 0 0 10px rgba(37,99,235,0.05)} }';
    document.head.appendChild(style);
  </script>
</body>
</html>`;
}

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export default function EvidenceMapView() {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';
  const { activeProject } = useProject();
  const { height } = useWindowDimensions();
  const [evidence, setEvidence] = useState<MapEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapSrc, setMapSrc] = useState<string | null>(null);

  // Locatie-instellen modal
  const [locationModal, setLocationModal] = useState(false);
  const [addressInput, setAddressInput]   = useState('');
  const [geoLoading, setGeoLoading]       = useState(false);
  const [geoError, setGeoError]           = useState<string | null>(null);
  const [geoResult, setGeoResult]         = useState<{ lat: number; lng: number; label: string } | null>(null);

  const geocodeAddress = async (q: string) => {
    setGeoLoading(true); setGeoError(null); setGeoResult(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=nl,be`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'nl' } });
      const json = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!json.length) { setGeoError('Adres niet gevonden — probeer het preciezer.'); return; }
      setGeoResult({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon), label: json[0].display_name });
    } catch { setGeoError('Geocoding mislukt — controleer je internetverbinding.'); }
    finally { setGeoLoading(false); }
  };

  const saveProjectLocation = async (lat: number, lng: number) => {
    await supabase.from('projects').update({ latitude: lat, longitude: lng }).eq('id', activeProject.id);
    setProjectLat(lat); setProjectLng(lng);
    setLocationModal(false); setGeoResult(null); setAddressInput('');
  };

  // Project-locatie: eerst uit de projects-tabel, dan env-var als fallback
  const [projectLat, setProjectLat] = useState<number | null>(PROJECT_LOCATION?.latitude ?? null);
  const [projectLng, setProjectLng] = useState<number | null>(PROJECT_LOCATION?.longitude ?? null);

  useEffect(() => {
    supabase
      .from('projects')
      .select('latitude, longitude')
      .eq('id', activeProject.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.latitude && data?.longitude) {
          setProjectLat(data.latitude as number);
          setProjectLng(data.longitude as number);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject.id]);

  const fetchEvidence = () => {
    setLoading(true);
    supabase
      .from('evidence')
      .select('id, inspection_point_id, latitude, longitude, gps_accuracy, timestamp, ai_status, sync_status')
      .eq('project_id', activeProject.id)
      .order('timestamp', { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); }
        else { setEvidence((data ?? []) as unknown as MapEvidence[]); }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEvidence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject.id]);

  const mapHtml = useMemo(
    () => buildMapHtml(evidence, isDark, projectLat, projectLng, PROJECT_RADIUS_METERS),
    [evidence, isDark, projectLat, projectLng]
  );

  // Blob URL aanmaken zodat externe CDN-scripts (Leaflet) kunnen laden
  // srcDoc blokkeert CDN-scripts in sandboxed iframes — blob: URL wel niet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([mapHtml], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    setMapSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [mapHtml]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const withGps = evidence.filter((e) => resolveCoords(e) !== null).length;
  const synced  = evidence.filter((e) => e.sync_status === 'SYNCED').length;
  const pending = evidence.filter((e) => e.sync_status === 'PENDING').length;

  if (!isWeb) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          🗺️ GPS Kaart is alleen beschikbaar in de web-versie.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header balk */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GPS Kaart — {activeProject.name}</Text>
          <Text style={styles.headerSub}>
            {withGps} locaties · {synced} cloud · {pending} lokaal
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setLocationModal(true)}
            style={[styles.refreshBtn, { paddingHorizontal: 10, borderRadius: 8, backgroundColor: projectLat ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.12)' }]}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: projectLat ? '#059669' : '#d97706' }}>
              {projectLat ? '📍 Locatie ✓' : '📍 Stel in'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchEvidence()}
            activeOpacity={0.75}
          >
            <Text style={styles.refreshBtnText}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.legendText}>Cloud veilig</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#d97706' }]} />
          <Text style={styles.legendText}>Lokaal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
          <Text style={styles.legendText}>Sync fout</Text>
        </View>
      </View>

      {/* Kaart — altijd tonen, ook zonder pins */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Kaart laden…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingBox}>
          <Text style={[styles.loadingText, { color: '#dc2626' }]}>❌ {error}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Lege staat melding bovenin — kaart blijft zichtbaar */}
          {withGps === 0 && (
            <View style={[styles.emptyBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                📍 Nog geen GPS-locaties — maak een foto om een pin te plaatsen.
              </Text>
            </View>
          )}

          {/* De kaart zelf — blob: URL zodat Leaflet CDN-scripts gewoon laden */}
          {mapSrc && (
            <iframe
              src={mapSrc}
              style={{
                width: '100%',
                height: Math.max(height - (withGps === 0 ? 260 : 220), 420),
                border: 'none',
                display: 'block',
              }}
              title="GPS Kaart"
            />
          )}

          {/* Navigatieknoppen naar projectlocatie */}
          {projectLat !== null && projectLng !== null && (
            <View style={styles.navBar}>
              <TouchableOpacity
                onPress={() => (window as Window).open(`https://www.google.com/maps?q=${projectLat},${projectLng}`, '_blank')}
                style={[styles.navBtn, { backgroundColor: '#4285F4' }]}
              >
                <Text style={styles.navBtnText}>📍 Google Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (window as Window).open(`https://maps.apple.com/?ll=${projectLat},${projectLng}&q=Project`, '_blank')}
                style={[styles.navBtn, { backgroundColor: '#1a1a1a' }]}
              >
                <Text style={styles.navBtnText}>🍎 Apple Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (window as Window).open(`https://bing.com/maps/default.aspx?cp=${projectLat}~${projectLng}&lvl=17`, '_blank')}
                style={[styles.navBtn, { backgroundColor: '#0078D4' }]}
              >
                <Text style={styles.navBtnText}>🔵 Bing Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (window as Window).open(`https://waze.com/ul?ll=${projectLat},${projectLng}&navigate=yes`, '_blank')}
                style={[styles.navBtn, { backgroundColor: '#33CCFF' }]}
              >
                <Text style={[styles.navBtnText, { color: '#000' }]}>🚗 Waze</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Projectlocatie instellen modal ── */}
      <Modal
        visible={locationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              📍 Projectlocatie instellen
            </Text>
            <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>
              Typ het adres van de bouwplaats — de kaart toont dan een geofence en de vaklieden zien of ze op de juiste locatie staan.
            </Text>

            <TextInput
              style={[styles.modalInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="bijv. Hoofdstraat 1, Amsterdam"
              placeholderTextColor={theme.colors.textSecondary}
              value={addressInput}
              onChangeText={setAddressInput}
              onSubmitEditing={() => addressInput.trim() && geocodeAddress(addressInput.trim())}
              returnKeyType="search"
              autoFocus
            />

            {geoError && (
              <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{geoError}</Text>
            )}

            {geoResult && (
              <View style={[styles.geoResultBox, { borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)' }]}>
                <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>✓ Gevonden</Text>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 12 }} numberOfLines={2}>{geoResult.label}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                  {geoResult.lat.toFixed(5)}, {geoResult.lng.toFixed(5)}
                </Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { setLocationModal(false); setGeoResult(null); setGeoError(null); }}
                style={[styles.modalBtnSecondary, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Annuleren</Text>
              </TouchableOpacity>

              {!geoResult ? (
                <TouchableOpacity
                  onPress={() => addressInput.trim() && geocodeAddress(addressInput.trim())}
                  disabled={geoLoading || !addressInput.trim()}
                  style={[styles.modalBtnPrimary, { backgroundColor: theme.colors.accent, opacity: geoLoading || !addressInput.trim() ? 0.5 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {geoLoading ? '🔍 Zoeken…' : '🔍 Zoek adres'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => saveProjectLocation(geoResult.lat, geoResult.lng)}
                  style={[styles.modalBtnPrimary, { backgroundColor: '#059669' }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✓ Sla op</Text>
                </TouchableOpacity>
              )}
            </View>

            {projectLat && (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Huidige locatie: {projectLat.toFixed(4)}, {projectLng?.toFixed(4)}
              </Text>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    emptyBanner: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    headerSub: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    refreshBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshBtnText: {
      fontSize: 18,
      color: theme.colors.textPrimary,
    },
    legend: {
      flexDirection: 'row',
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    placeholderText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    navBar: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    navBtn: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    navBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      borderRadius: 16,
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    modalSub: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 12,
    },
    geoResultBox: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    modalBtns: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    modalBtnSecondary: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    modalBtnPrimary: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
  });
