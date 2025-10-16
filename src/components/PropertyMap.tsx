// src/components/PropertyMap.tsx
// Complete implementation for Leaflet.js map with OpenStreetMap
// Works with your Express backend on localhost:4000

import React, { useEffect, useRef, useState } from 'react';
import { Listing } from '@/lib/api';
import { MapPin, Layers, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Import Leaflet types
// Make sure you have: npm install leaflet @types/leaflet
// And Leaflet CSS in public/index.html

interface PropertyMapProps {
  properties: Listing[];
  onPropertySelect?: (property: Listing) => void;
  selectedProperty?: Listing | null;
  className?: string;
}

interface ReferenceLocation {
  id: string;
  name: string;
  type: 'university' | 'transit' | 'employer';
  latitude: number;
  longitude: number;
  address?: string;
}

export function PropertyMap({ 
  properties, 
  onPropertySelect, 
  selectedProperty,
  className = ""
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [referenceLocations, setReferenceLocations] = useState<ReferenceLocation[]>([]);
  const [showReferenceLocations, setShowReferenceLocations] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // DC Metro area center (between Arlington, Alexandria, Fairfax)
  const DC_METRO_CENTER = { lat: 38.8339, lng: -77.0648 };

  // Initialize map and load Leaflet
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || map) return;

    const initMap = async () => {
      try {
        // @ts-ignore - Dynamic import
        const L = await import('leaflet');
        
        // Fix marker icon paths (common issue with Leaflet + bundlers)
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Create map
        const leafletMap = L.map(mapRef.current!, {
          center: [DC_METRO_CENTER.lat, DC_METRO_CENTER.lng],
          zoom: 11,
          zoomControl: true,
          scrollWheelZoom: true,
        });

        // Add OpenStreetMap tile layer (FREE - no API key needed!)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(leafletMap);

        setMap(leafletMap);
        setIsLoaded(true);

        // Fetch reference locations from your Express backend
        fetchReferenceLocations();

      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to load map. Please refresh the page.');
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (map) {
        map.remove();
        setMap(null);
      }
    };
  }, []);

  // Fetch reference locations (universities, metro, employers)
  const fetchReferenceLocations = async () => {
    try {
      // Call your Express backend
      const response = await fetch('http://localhost:4000/api/v1/map/reference-locations');
      if (response.ok) {
        const data = await response.json();
        setReferenceLocations(data);
      } else {
        console.warn('Failed to fetch reference locations');
      }
    } catch (error) {
      console.error('Error fetching reference locations:', error);
      // Set fallback data if API fails
      setReferenceLocations([
        {
          id: 'ref1',
          name: 'George Mason University',
          type: 'university',
          latitude: 38.8297,
          longitude: -77.3080,
          address: '4400 University Dr, Fairfax, VA'
        },
        {
          id: 'ref2',
          name: 'Rosslyn Metro',
          type: 'transit',
          latitude: 38.8964,
          longitude: -77.0716,
          address: '1850 N Moore St, Arlington, VA'
        },
        {
          id: 'ref3',
          name: 'Pentagon',
          type: 'employer',
          latitude: 38.8719,
          longitude: -77.0563,
          address: 'Pentagon, Arlington, VA'
        }
      ]);
    }
  };

  // Add property and reference location markers
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Import Leaflet again for marker creation
    import('leaflet').then((L) => {
      // Clear existing markers
      markers.forEach(m => m.remove());
      const newMarkers: any[] = [];

      // Add property markers
      properties.forEach((property) => {
        // Check if property has coordinates
        if (!property.latitude || !property.longitude) {
          console.warn('Property missing coordinates:', property.name || property.title);
          return;
        }

        const isSelected = property.id === selectedProperty?.id;

        // Custom icon for properties (VT colors!)
        const propertyIcon = L.divIcon({
          className: 'custom-property-marker',
          html: `
            <div style="
              background: ${isSelected ? '#F47C2A' : '#630031'};
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s;
            "
            onmouseover="this.style.transform='scale(1.1)'"
            onmouseout="this.style.transform='scale(1)'"
            >
              <span style="color: white; font-size: 16px; font-weight: bold;">$</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([property.latitude, property.longitude], {
          icon: propertyIcon,
          title: property.name || property.title
        }).addTo(map);

        // Get property details for popup
        const name = property.name || property.title || 'Unnamed Property';
        const price = property.price || property.rent_min || property.min_rent || 0;
        const beds = property.beds || property.unit_beds || 0;
        const baths = property.baths || property.unit_baths || 1;
        const address = property.address || '';
        const intlFriendly = property.intlFriendly || false;

        // Popup content with property info
        const popupContent = `
          <div style="min-width: 220px; font-family: Inter, sans-serif;">
            <h3 style="font-weight: 600; margin: 0 0 8px 0; font-size: 16px; color: #630031;">
              ${name}
            </h3>
            <p style="color: #F47C2A; font-size: 20px; font-weight: bold; margin: 4px 0;">
              $${Number(price).toLocaleString()}<span style="font-size: 14px; font-weight: normal;">/mo</span>
            </p>
            <p style="font-size: 13px; color: #666; margin: 8px 0;">
              📍 ${address}
            </p>
            <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
              <span style="background: #f3f4f6; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500;">
                🛏️ ${beds} bed${beds !== 1 ? 's' : ''}
              </span>
              <span style="background: #f3f4f6; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500;">
                🚿 ${baths} bath${baths !== 1 ? 's' : ''}
              </span>
            </div>
            ${intlFriendly ? `
              <div style="margin-top: 8px;">
                <span style="background: #F47C2A; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                  🌍 International Friendly
                </span>
              </div>
            ` : ''}
            <button 
              onclick="window.location.href='/properties/${property.id}'"
              style="
                width: 100%;
                margin-top: 12px;
                padding: 8px;
                background: #630031;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 13px;
              "
              onmouseover="this.style.background='#F47C2A'"
              onmouseout="this.style.background='#630031'"
            >
              View Details →
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 250,
          className: 'custom-popup'
        });

        // Handle marker click
        marker.on('click', () => {
          onPropertySelect?.(property);
        });

        // Auto-open popup if this property is selected
        if (isSelected) {
          marker.openPopup();
        }

        newMarkers.push(marker);
      });

      // Add reference location markers (if enabled)
      if (showReferenceLocations) {
        referenceLocations.forEach((location) => {
          if (!location.latitude || !location.longitude) return;

          const getLocationStyle = (type: string) => {
            const styles = {
              university: { color: '#3b82f6', icon: '🎓', label: 'University' },
              transit: { color: '#10b981', icon: '🚇', label: 'Transit' },
              employer: { color: '#8b5cf6', icon: '🏢', label: 'Employer' }
            };
            return styles[type as keyof typeof styles] || { color: '#666', icon: '📍', label: 'Location' };
          };

          const style = getLocationStyle(location.type);

          const refIcon = L.divIcon({
            className: 'custom-reference-marker',
            html: `
              <div style="
                background: ${style.color};
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
              ">
                <span style="font-size: 16px;">${style.icon}</span>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([location.latitude, location.longitude], {
            icon: refIcon,
            title: location.name
          }).addTo(map);

          marker.bindPopup(`
            <div style="min-width: 180px; font-family: Inter, sans-serif;">
              <h4 style="font-weight: 600; margin: 0 0 6px 0; font-size: 14px; color: ${style.color};">
                ${location.name}
              </h4>
              <p style="font-size: 12px; color: #666; text-transform: capitalize; margin: 4px 0;">
                ${style.label}
              </p>
              ${location.address ? `
                <p style="font-size: 11px; color: #999; margin-top: 6px;">
                  📍 ${location.address}
                </p>
              ` : ''}
            </div>
          `);

          newMarkers.push(marker);
        });
      }

      setMarkers(newMarkers);

      // Fit map bounds to show all properties
      if (properties.length > 0) {
        const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude);
        
        if (propertiesWithCoords.length > 0) {
          const bounds = L.latLngBounds(
            propertiesWithCoords.map(p => [p.latitude!, p.longitude!])
          );
          map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 14
          });
        }
      }
    });
  }, [map, properties, selectedProperty, isLoaded, showReferenceLocations, referenceLocations]);

  // Center map on selected property
  useEffect(() => {
    if (map && selectedProperty && selectedProperty.latitude && selectedProperty.longitude) {
      map.setView([selectedProperty.latitude, selectedProperty.longitude], 14, {
        animate: true,
        duration: 0.5
      });
    }
  }, [map, selectedProperty]);

  // Show error state if map failed to load
  if (mapError) {
    return (
      <div className={`flex items-center justify-center bg-surface rounded-lg border border-surface-3 ${className}`}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-foreground">Map Unavailable</h3>
          <p className="text-sm text-muted-foreground">{mapError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="mt-4"
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg border border-surface-3 overflow-hidden"
        style={{ minHeight: '500px' }}
      />
      
      {/* Loading State */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Map Controls */}
      {isLoaded && (
        <>
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/95 backdrop-blur-sm shadow-lg"
              onClick={() => setShowReferenceLocations(!showReferenceLocations)}
            >
              <Layers className="h-4 w-4 mr-1" />
              {showReferenceLocations ? 'Hide' : 'Show'} Landmarks
            </Button>
            
            {/* Recenter button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-background/95 backdrop-blur-sm shadow-lg"
              onClick={() => {
                if (map && properties.length > 0) {
                  const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude);
                  if (propertiesWithCoords.length > 0) {
                    // @ts-ignore
                    import('leaflet').then((L) => {
                      const bounds = L.latLngBounds(
                        propertiesWithCoords.map(p => [p.latitude!, p.longitude!])
                      );
                      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                    });
                  }
                }
              }}
              title="Recenter map to show all properties"
            >
              <Navigation className="h-4 w-4 mr-1" />
              Recenter
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg border border-surface-3 p-3 shadow-lg z-[1000]">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary border-2 border-white"></div>
                <span className="text-foreground">Properties</span>
              </div>
              {showReferenceLocations && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[8px]">
                      🎓
                    </div>
                    <span className="text-foreground">Universities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[8px]">
                      🚇
                    </div>
                    <span className="text-foreground">Transit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-[8px]">
                      🏢
                    </div>
                    <span className="text-foreground">Employers</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Property Count Badge */}
          <div className="absolute top-4 left-4 z-[1000]">
            <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
              <MapPin className="h-3 w-3 mr-1" />
              {properties.filter(p => p.latitude && p.longitude).length} properties
            </Badge>
          </div>
        </>
      )}
    </div>
  );
}
