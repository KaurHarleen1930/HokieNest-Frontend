// frontend/src/components/Map/TransitMapOverlay.jsx
// Map overlay for transit stations and routes

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchTransitStations, fetchNearbyTransit } from '../../services/transitService';

// Metro line colors
const LINE_COLORS = {
  red: '#E51937',
  blue: '#1B7DBD',
  orange: '#F68B1F',
  green: '#00B156',
  yellow: '#FFD100',
  silver: '#A0A2A0'
};

// Custom metro station icon
const metroIcon = L.divIcon({
  className: 'custom-metro-marker',
  html: `
    <div style="
      background-color: #2c3e50;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="color: white; font-size: 14px; font-weight: bold;">M</span>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Bus stop icon
const busIcon = L.divIcon({
  className: 'custom-bus-marker',
  html: `
    <div style="
      background-color: #f39c12;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="color: white; font-size: 12px;">🚌</span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const TransitMapOverlay = ({ 
  propertyId,
  propertyLocation, 
  initialZoom = 13,
  maxRadius = 2 // miles
}) => {
  const [transitStations, setTransitStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [filters, setFilters] = useState({
    showMetro: true,
    showBus: false,
    lines: {
      red: true,
      blue: true,
      orange: true,
      green: true,
      yellow: true,
      silver: true
    }
  });

  useEffect(() => {
    if (propertyId) {
      loadNearbyTransit();
    }
  }, [propertyId, filters]);

  const loadNearbyTransit = async () => {
    setLoading(true);
    try {
      const params = {
        maxDistance: maxRadius
      };

      if (filters.showMetro && !filters.showBus) {
        params.type = 'metro';
      } else if (filters.showBus && !filters.showMetro) {
        params.type = 'bus_stop';
      }

      const response = await fetchNearbyTransit(propertyId, params);
      
      // Filter by selected metro lines
      const filteredStations = response.data.filter(station => {
        if (station.station_type === 'bus_stop') return filters.showBus;
        if (station.station_type === 'metro') {
          if (!filters.showMetro) return false;
          
          // Check if station serves any of the selected lines
          const stationLines = station.lines || [];
          return stationLines.some(line => filters.lines[line.toLowerCase()]);
        }
        return true;
      });

      setTransitStations(filteredStations);
    } catch (error) {
      console.error('Error loading transit stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filterName) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const toggleLine = (lineName) => {
    setFilters(prev => ({
      ...prev,
      lines: {
        ...prev.lines,
        [lineName]: !prev.lines[lineName]
      }
    }));
  };

  const getStationIcon = (stationType) => {
    return stationType === 'metro' ? metroIcon : busIcon;
  };

  const getLineColor = (lines) => {
    if (!lines || lines.length === 0) return '#2c3e50';
    return LINE_COLORS[lines[0].toLowerCase()] || '#2c3e50';
  };

  return (
    <div className="transit-map-container" style={{ position: 'relative', width: '100%', height: '500px' }}>
      {/* Filter Controls */}
      <div className="transit-controls" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Transit Options</h4>
        
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.showMetro}
            onChange={() => toggleFilter('showMetro')}
            style={{ marginRight: '8px' }}
          />
          <span><strong>Metro Stations</strong></span>
        </label>

        {filters.showMetro && (
          <div style={{ marginLeft: '20px', marginBottom: '10px' }}>
            {Object.entries(LINE_COLORS).map(([lineName, color]) => (
              <label 
                key={lineName}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '5px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.lines[lineName]}
                  onChange={() => toggleLine(lineName)}
                  style={{ marginRight: '8px' }}
                />
                <span 
                  style={{ 
                    width: '15px', 
                    height: '15px', 
                    backgroundColor: color,
                    marginRight: '5px',
                    borderRadius: '2px'
                  }}
                />
                <span style={{ textTransform: 'capitalize' }}>{lineName}</span>
              </label>
            ))}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.showBus}
            onChange={() => toggleFilter('showBus')}
            style={{ marginRight: '8px' }}
          />
          <span><strong>Bus Stops</strong></span>
        </label>

        {loading && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Loading...
          </div>
        )}
      </div>

      {/* Map */}
      <MapContainer
        center={[propertyLocation.lat, propertyLocation.lng]}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={[propertyLocation.lat, propertyLocation.lng]} zoom={initialZoom} />

        {/* Property Marker */}
        <Marker
          position={[propertyLocation.lat, propertyLocation.lng]}
          icon={L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/marker/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })}
        >
          <Popup>
            <div>
              <strong>{propertyLocation.name || 'Your Property'}</strong>
            </div>
          </Popup>
        </Marker>

        {/* Transit Station Markers */}
        {transitStations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={getStationIcon(station.station_type)}
            eventHandlers={{
              click: () => setSelectedStation(station)
            }}
          >
            <Popup maxWidth={300}>
              <div style={{ padding: '5px' }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '16px',
                  color: getLineColor(station.lines)
                }}>
                  {station.name}
                </h3>
                
                {station.station_type === 'metro' && station.lines && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Lines:</strong>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                      {station.lines.map((line) => (
                        <span
                          key={line}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: LINE_COLORS[line.toLowerCase()],
                            color: 'white',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  {station.address}
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '8px',
                  fontSize: '12px',
                  marginBottom: '8px'
                }}>
                  <div>
                    <strong>Distance:</strong><br/>
                    {station.distance_miles} mi
                  </div>
                  <div>
                    <strong>Walk Time:</strong><br/>
                    {station.walking_time_minutes} min
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '10px',
                  fontSize: '11px',
                  color: '#666'
                }}>
                  {station.has_parking && <span>🅿️ Parking</span>}
                  {station.has_bike_rack && <span>🚴 Bike Rack</span>}
                  {station.is_accessible && <span>♿ Accessible</span>}
                </div>

                {station.wmata_station_code && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '5px',
                    backgroundColor: '#ecf0f1',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    Station Code: <strong>{station.wmata_station_code}</strong>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Draw walking paths from property to nearest stations */}
        {transitStations.slice(0, 3).map((station) => (
          <Polyline
            key={`path-${station.id}`}
            positions={[
              [propertyLocation.lat, propertyLocation.lng],
              [station.latitude, station.longitude]
            ]}
            pathOptions={{
              color: '#3498db',
              weight: 2,
              opacity: 0.5,
              dashArray: '5, 10'
            }}
          />
        ))}
      </MapContainer>

      {/* Stats Panel */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '10px',
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        fontSize: '12px',
        zIndex: 1000,
        minWidth: '200px'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>Transit Access</strong>
        </div>
        <div>
          {filters.showMetro && (
            <div>Metro Stations: <strong>{transitStations.filter(s => s.station_type === 'metro').length}</strong></div>
          )}
          {filters.showBus && (
            <div>Bus Stops: <strong>{transitStations.filter(s => s.station_type === 'bus_stop').length}</strong></div>
          )}
        </div>
        {transitStations.length > 0 && (
          <div style={{ marginTop: '8px', color: '#27ae60', fontWeight: 'bold' }}>
            Nearest: {transitStations[0].distance_miles} mi ({transitStations[0].walking_time_minutes} min walk)
          </div>
        )}
      </div>
    </div>
  );
};

export default TransitMapOverlay;
