// frontend/src/components/Map/AttractionsMapOverlay.jsx
// Map overlay for restaurants, bars, and attractions

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchAttractions } from '../../services/attractionsService';

// Custom marker icons for different attraction types
const createCustomIcon = (category, color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="color: white; font-size: 16px;">
          ${category === 'restaurant' ? '🍽️' : category === 'bar' ? '🍺' : '🎭'}
        </span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const icons = {
  restaurant: createCustomIcon('restaurant', '#e74c3c'),
  bar: createCustomIcon('bar', '#9b59b6'),
  attraction: createCustomIcon('attraction', '#3498db'),
};

// Component to handle map updates
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const AttractionsMapOverlay = ({ 
  propertyLocation, 
  initialZoom = 14,
  maxRadius = 2 // miles
}) => {
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    restaurants: true,
    bars: true,
    attractions: true,
    minRating: 0,
  });

  useEffect(() => {
    if (propertyLocation) {
      loadAttractions();
    }
  }, [propertyLocation, filters]);

  const loadAttractions = async () => {
    setLoading(true);
    try {
      const categories = [];
      if (filters.restaurants) categories.push('restaurant');
      if (filters.bars) categories.push('bar');
      if (filters.attractions) categories.push('attraction');

      const allAttractions = [];
      for (const category of categories) {
        const response = await fetchAttractions({
          category,
          lat: propertyLocation.lat,
          lng: propertyLocation.lng,
          radius: maxRadius,
          minRating: filters.minRating,
          limit: 50
        });
        allAttractions.push(...response.data);
      }

      setAttractions(allAttractions);
    } catch (error) {
      console.error('Error loading attractions:', error);
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

  const handleRatingChange = (rating) => {
    setFilters(prev => ({
      ...prev,
      minRating: rating
    }));
  };

  return (
    <div className="attractions-map-container" style={{ position: 'relative', width: '100%', height: '500px' }}>
      {/* Filter Controls */}
      <div className="map-controls" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Show on Map</h4>
        
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.restaurants}
            onChange={() => toggleFilter('restaurants')}
            style={{ marginRight: '8px' }}
          />
          <span style={{ display: 'flex', alignItems: 'center' }}>
            🍽️ Restaurants
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.bars}
            onChange={() => toggleFilter('bars')}
            style={{ marginRight: '8px' }}
          />
          <span style={{ display: 'flex', alignItems: 'center' }}>
            🍺 Bars
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.attractions}
            onChange={() => toggleFilter('attractions')}
            style={{ marginRight: '8px' }}
          />
          <span style={{ display: 'flex', alignItems: 'center' }}>
            🎭 Attractions
          </span>
        </label>

        <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
          <label style={{ fontSize: '12px', marginBottom: '5px', display: 'block' }}>
            Min Rating
          </label>
          <select
            value={filters.minRating}
            onChange={(e) => handleRatingChange(parseFloat(e.target.value))}
            style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="0">All</option>
            <option value="3.0">3.0+</option>
            <option value="3.5">3.5+</option>
            <option value="4.0">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>

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
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
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

        {/* Attraction Markers */}
        {attractions.map((attraction) => (
          <Marker
            key={attraction.id}
            position={[attraction.latitude, attraction.longitude]}
            icon={icons[attraction.category]}
          >
            <Popup maxWidth={250}>
              <div style={{ padding: '5px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{attraction.name}</h3>
                {attraction.rating && (
                  <div style={{ marginBottom: '5px' }}>
                    ⭐ {attraction.rating} 
                    {attraction.price_level && (
                      <span style={{ marginLeft: '10px' }}>
                        {'$'.repeat(attraction.price_level)}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  {attraction.address}
                </div>
                {attraction.distance_miles && (
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2980b9' }}>
                    📍 {attraction.distance_miles} miles away
                  </div>
                )}
                {attraction.subcategory && (
                  <div style={{ 
                    marginTop: '5px', 
                    padding: '3px 8px', 
                    backgroundColor: '#ecf0f1', 
                    borderRadius: '12px',
                    fontSize: '11px',
                    display: 'inline-block'
                  }}>
                    {attraction.subcategory}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '10px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ marginRight: '8px' }}>📍</span>
          <strong>Your Property</strong>
        </div>
        <div>
          Showing {attractions.length} locations within {maxRadius} miles
        </div>
      </div>
    </div>
  );
};

export default AttractionsMapOverlay;
