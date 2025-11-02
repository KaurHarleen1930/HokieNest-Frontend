// frontend/src/components/Property/PropertyDetailsWithAmenities.jsx
// Enhanced property details page with attractions and transit

import React, { useState, useEffect } from 'react';
import AttractionsMapOverlay from '../Map/AttractionsMapOverlay';
import TransitMapOverlay from '../Map/TransitMapOverlay';
import { fetchNearbyAttractions } from '../../services/attractionsService';
import { fetchNearbyTransit } from '../../services/transitService';
import './PropertyDetails.css';

const PropertyDetailsWithAmenities = ({ property }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [nearbyAttractions, setNearbyAttractions] = useState({
    restaurants: [],
    bars: [],
    attractions: []
  });
  const [nearbyTransit, setNearbyTransit] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (property?.id) {
      loadNearbyData();
    }
  }, [property?.id]);

  const loadNearbyData = async () => {
    setLoading(true);
    try {
      // Load attractions
      const [restaurantsRes, barsRes, attractionsRes, transitRes] = await Promise.all([
        fetchNearbyAttractions(property.id, { category: 'restaurant', maxDistance: 1 }),
        fetchNearbyAttractions(property.id, { category: 'bar', maxDistance: 1 }),
        fetchNearbyAttractions(property.id, { category: 'attraction', maxDistance: 2 }),
        fetchNearbyTransit(property.id, { maxDistance: 1 })
      ]);

      setNearbyAttractions({
        restaurants: restaurantsRes.data,
        bars: barsRes.data,
        attractions: attractionsRes.data
      });
      setNearbyTransit(transitRes.data);
    } catch (error) {
      console.error('Error loading nearby data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'units', label: 'Units', icon: '🚪' },
    { id: 'location', label: 'Location & Map', icon: '📍' },
    { id: 'dining', label: 'Dining & Nightlife', icon: '🍽️' },
    { id: 'transit', label: 'Transit', icon: '🚇' }
  ];

  return (
    <div className="property-details-container">
      {/* Property Header */}
      <div className="property-header">
        <img 
          src={property.thumbnail_url} 
          alt={property.name}
          className="property-image"
        />
        <div className="property-info">
          <h1>{property.name}</h1>
          <p className="address">{property.address}</p>
          <div className="quick-stats">
            <span>🏢 {property.total_units} Units</span>
            <span>📅 Built {property.year_built}</span>
            <span>📞 {property.phone_number}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-content">
            <section className="description-section">
              <h2>About This Property</h2>
              <p>{property.description || 'Contact property for more details.'}</p>
            </section>

            <section className="amenities-section">
              <h2>Property Amenities</h2>
              <div className="amenities-grid">
                {property.amenities && Object.entries(property.amenities).map(([key, value]) => (
                  <div key={key} className="amenity-item">
                    <span className="amenity-icon">✓</span>
                    <span>{key.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="highlights-section">
              <h2>Neighborhood Highlights</h2>
              <div className="highlights-grid">
                <div className="highlight-card">
                  <div className="highlight-icon">🍽️</div>
                  <div className="highlight-number">{nearbyAttractions.restaurants.length}</div>
                  <div className="highlight-label">Restaurants Nearby</div>
                </div>
                <div className="highlight-card">
                  <div className="highlight-icon">🍺</div>
                  <div className="highlight-number">{nearbyAttractions.bars.length}</div>
                  <div className="highlight-label">Bars & Nightlife</div>
                </div>
                <div className="highlight-card">
                  <div className="highlight-icon">🎭</div>
                  <div className="highlight-number">{nearbyAttractions.attractions.length}</div>
                  <div className="highlight-label">Attractions</div>
                </div>
                <div className="highlight-card">
                  <div className="highlight-icon">🚇</div>
                  <div className="highlight-number">{nearbyTransit.length}</div>
                  <div className="highlight-label">Transit Stations</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Location & Map Tab */}
        {activeTab === 'location' && (
          <div className="location-content">
            <h2>Interactive Location Map</h2>
            <p className="section-description">
              Explore the neighborhood and see nearby amenities, dining, and attractions
            </p>
            <AttractionsMapOverlay
              propertyLocation={{
                lat: property.latitude,
                lng: property.longitude,
                name: property.name
              }}
              initialZoom={14}
              maxRadius={2}
            />
          </div>
        )}

        {/* Dining & Nightlife Tab */}
        {activeTab === 'dining' && (
          <div className="dining-content">
            <h2>Restaurants & Bars</h2>
            
            {/* Restaurants */}
            <section className="category-section">
              <h3>🍽️ Nearby Restaurants ({nearbyAttractions.restaurants.length})</h3>
              <div className="places-list">
                {nearbyAttractions.restaurants.slice(0, 10).map(restaurant => (
                  <div key={restaurant.id} className="place-card">
                    <div className="place-info">
                      <h4>{restaurant.name}</h4>
                      <p className="place-address">{restaurant.address}</p>
                      <div className="place-meta">
                        {restaurant.rating && (
                          <span className="rating">⭐ {restaurant.rating}</span>
                        )}
                        {restaurant.price_level && (
                          <span className="price">{'$'.repeat(restaurant.price_level)}</span>
                        )}
                        <span className="distance">📍 {restaurant.distance_miles} mi ({restaurant.walking_time_minutes} min walk)</span>
                      </div>
                      {restaurant.subcategory && (
                        <span className="category-badge">{restaurant.subcategory}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bars */}
            <section className="category-section">
              <h3>🍺 Bars & Nightlife ({nearbyAttractions.bars.length})</h3>
              <div className="places-list">
                {nearbyAttractions.bars.slice(0, 10).map(bar => (
                  <div key={bar.id} className="place-card">
                    <div className="place-info">
                      <h4>{bar.name}</h4>
                      <p className="place-address">{bar.address}</p>
                      <div className="place-meta">
                        {bar.rating && (
                          <span className="rating">⭐ {bar.rating}</span>
                        )}
                        {bar.price_level && (
                          <span className="price">{'$'.repeat(bar.price_level)}</span>
                        )}
                        <span className="distance">📍 {bar.distance_miles} mi</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Attractions */}
            {nearbyAttractions.attractions.length > 0 && (
              <section className="category-section">
                <h3>🎭 Attractions ({nearbyAttractions.attractions.length})</h3>
                <div className="places-list">
                  {nearbyAttractions.attractions.slice(0, 10).map(attraction => (
                    <div key={attraction.id} className="place-card">
                      <div className="place-info">
                        <h4>{attraction.name}</h4>
                        <p className="place-address">{attraction.address}</p>
                        <div className="place-meta">
                          {attraction.rating && (
                            <span className="rating">⭐ {attraction.rating}</span>
                          )}
                          <span className="distance">📍 {attraction.distance_miles} mi</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Transit Tab */}
        {activeTab === 'transit' && (
          <div className="transit-content">
            <h2>Public Transportation</h2>
            <p className="section-description">
              View nearby metro stations, bus stops, and calculate your commute
            </p>

            {/* Transit Map */}
            <TransitMapOverlay
              propertyId={property.id}
              propertyLocation={{
                lat: property.latitude,
                lng: property.longitude,
                name: property.name
              }}
              initialZoom={14}
              maxRadius={1.5}
            />

            {/* Transit List */}
            <section className="transit-list-section">
              <h3>🚇 Nearby Metro Stations</h3>
              <div className="transit-list">
                {nearbyTransit
                  .filter(station => station.station_type === 'metro')
                  .map(station => (
                    <div key={station.id} className="transit-card">
                      <div className="transit-icon">🚇</div>
                      <div className="transit-info">
                        <h4>{station.name}</h4>
                        <div className="metro-lines">
                          {station.lines && station.lines.map(line => (
                            <span 
                              key={line} 
                              className={`metro-line-badge ${line.toLowerCase()}`}
                            >
                              {line}
                            </span>
                          ))}
                        </div>
                        <p className="transit-address">{station.address}</p>
                        <div className="transit-distance">
                          <span>📍 {station.distance_miles} mi</span>
                          <span>🚶 {station.walking_time_minutes} min walk</span>
                          {station.has_parking && <span>🅿️ Parking</span>}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetailsWithAmenities;
