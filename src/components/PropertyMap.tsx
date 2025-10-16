import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Listing } from '@/lib/api';
import { MapPin, Navigation, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Declare global google types
declare global {
  interface Window {
    google: typeof google;
  }
}

interface PropertyMapProps {
  properties: Listing[];
  onPropertySelect?: (property: Listing) => void;
  selectedProperty?: Listing;
  className?: string;
}

export function PropertyMap({
  properties,
  onPropertySelect,
  selectedProperty,
  className = ""
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<google.maps.InfoWindow | null>(null);
  const [hoverInfoWindows, setHoverInfoWindows] = useState<google.maps.InfoWindow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

  // Always try to load the map if API key is available
  const [showApiInput, setShowApiInput] = useState(false);

  // DC Metro area center (between Alexandria and Arlington VT campuses)
  const DC_METRO_CENTER = { lat: 38.8339, lng: -77.0648 };

  // VT Campus locations
  const VT_CAMPUSES = [
    { name: 'VT Alexandria Campus', lat: 38.8051, lng: -77.0470 },
    { name: 'VT Arlington Campus', lat: 38.8816, lng: -77.1025 }
  ];

  useEffect(() => {
    if (!mapRef.current) return;

    // Always try to load the map, even without API key (will show fallback)
    if (!apiKey) {
      setIsLoaded(true);
      return;
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });

    loader.load().then(() => {
      const googleMap = new google.maps.Map(mapRef.current!, {
        center: DC_METRO_CENTER,
        zoom: 11,
        styles: [
          {
            featureType: 'all',
            stylers: [{ saturation: -10 }]
          },
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(googleMap);
      setIsLoaded(true);

      // Add VT campus markers
      VT_CAMPUSES.forEach(campus => {
        new google.maps.Marker({
          position: { lat: campus.lat, lng: campus.lng },
          map: googleMap,
          title: campus.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2C9.373 2 4 7.373 4 14c0 8 12 22 12 22s12-14 12-22c0-6.627-5.373-12-12-12z" fill="#E87722" stroke="white" stroke-width="2"/>
                  <text x="16" y="18" font-family="Arial" font-size="8" font-weight="bold" fill="white" text-anchor="middle">VT</text>
                </svg>
              `),
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 38)
          }
        });
      });
    }).catch((error) => {
      console.error('Error loading Google Maps:', error);
      setIsLoaded(true);
    });
  }, [apiKey]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Clear existing markers and info windows
    markers.forEach(marker => marker.setMap(null));
    if (selectedMarker) {
      selectedMarker.close();
    }
    hoverInfoWindows.forEach(infoWindow => infoWindow.close());

    const newMarkers: google.maps.Marker[] = [];
    const newHoverInfoWindows: google.maps.InfoWindow[] = [];

    properties.forEach(property => {
      // Use actual coordinates from backend if available, otherwise generate stable coordinates
      let lat, lng;

      if ((property as any).latitude && (property as any).longitude) {
        // Use real coordinates from backend
        lat = (property as any).latitude;
        lng = (property as any).longitude;
      } else {
        // Generate stable coordinates based on property ID (so they don't move)
        const hash = property.id.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const seed1 = Math.abs(hash) % 1000 / 1000;
        const seed2 = Math.abs(hash * 7) % 1000 / 1000;

        lat = DC_METRO_CENTER.lat + (seed1 - 0.5) * 0.2;
        lng = DC_METRO_CENTER.lng + (seed2 - 0.5) * 0.2;
      }

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: property.title,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2C11.716 2 5 8.716 5 17c0 10 15 28 15 28s15-18 15-28c0-8.284-6.716-15-15-15z" fill="${selectedProperty?.id === property.id ? '#DC2626' : '#630031'}" stroke="white" stroke-width="3"/>
              <text x="20" y="22" font-family="Arial" font-size="10" font-weight="bold" fill="white" text-anchor="middle">$${Math.floor(property.price)}</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(40, 50),
          anchor: new google.maps.Point(20, 48)
        }
      });

      // Create hover info window
      const hoverInfoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 280px; font-family: Arial, sans-serif;">
            <h3 style="margin: 0 0 8px 0; color: #630031; font-weight: bold; font-size: 16px;">${property.title}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${property.address}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: bold; color: #E87722; font-size: 18px;">$${property.price.toLocaleString()}/month</span>
              <div style="display: flex; gap: 8px; font-size: 12px; color: #666;">
                <span>${property.beds} bed${property.beds !== 1 ? 's' : ''}</span>
                <span>${property.baths} bath${property.baths !== 1 ? 's' : ''}</span>
              </div>
            </div>
            ${property.description ? `<p style="margin: 0 0 8px 0; color: #555; font-size: 13px; line-height: 1.4;">${property.description.substring(0, 100)}${property.description.length > 100 ? '...' : ''}</p>` : ''}
            ${property.amenities && property.amenities.length > 0 ? `
              <div style="margin-top: 8px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: bold;">Amenities:</p>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${property.amenities.slice(0, 3).map(amenity =>
          `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #555;">${amenity}</span>`
        ).join('')}
                  ${property.amenities.length > 3 ? `<span style="font-size: 11px; color: #999;">+${property.amenities.length - 3} more</span>` : ''}
                </div>
              </div>
            ` : ''}
            ${property.intlFriendly ? `<div style="margin-top: 8px;"><span style="background: #E87722; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">International Friendly</span></div>` : ''}
          </div>
        `
      });

      // Add hover events
      marker.addListener('mouseover', () => {
        hoverInfoWindow.open(map, marker);
      });

      marker.addListener('mouseout', () => {
        hoverInfoWindow.close();
      });

      // Add to arrays for cleanup
      newMarkers.push(marker);
      newHoverInfoWindows.push(hoverInfoWindow);

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; max-width: 250px;">
            <h3 style="margin: 0 0 8px 0; color: #630031; font-weight: bold;">${property.title}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${property.address}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: bold; color: #E87722; font-size: 18px;">$${property.price}/month</span>
              <div style="display: flex; gap: 8px; font-size: 12px; color: #666;">
                <span>${property.beds} beds</span>
                <span>${property.baths} baths</span>
              </div>
            </div>
            ${property.intlFriendly ? '<span style="background: #E87722; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Intl Friendly</span>' : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        if (selectedMarker) {
          selectedMarker.close();
        }
        infoWindow.open(map, marker);
        setSelectedMarker(infoWindow);
        onPropertySelect?.(property);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    setHoverInfoWindows(newHoverInfoWindows);
  }, [map, properties, selectedProperty, isLoaded]);

  // Show fallback view if no API key or map failed to load
  if (!apiKey) {
    return (
      <Card className={`${className} flex items-center justify-center p-8`}>
        <CardContent className="text-center max-w-md">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Map View</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {properties.length} properties available
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {properties.slice(0, 5).map((property) => (
              <div
                key={property.id}
                className={`p-2 rounded border cursor-pointer transition-colors ${selectedProperty?.id === property.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => onPropertySelect?.(property)}
              >
                <div className="text-sm font-medium truncate">{property.title}</div>
                <div className="text-xs text-gray-600">${property.price}/mo</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Map controls can be added here if needed */}
      </div>

      {/* Property Count */}
      <div className="absolute bottom-4 left-4">
        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
          {properties.length} properties shown
        </Badge>
      </div>
    </div>
  );
}