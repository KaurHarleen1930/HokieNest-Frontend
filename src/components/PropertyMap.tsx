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
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Temporary API key input for demo purposes
  const [showApiInput, setShowApiInput] = useState(!apiKey);

  // DC Metro area center (between Alexandria and Arlington VT campuses)
  const DC_METRO_CENTER = { lat: 38.8339, lng: -77.0648 };
  
  // VT Campus locations
  const VT_CAMPUSES = [
    { name: 'VT Alexandria Campus', lat: 38.8051, lng: -77.0470 },
    { name: 'VT Arlington Campus', lat: 38.8816, lng: -77.1025 }
  ];

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

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
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="#630031" stroke="white" stroke-width="3"/>
                <text x="16" y="20" font-family="Arial" font-size="10" font-weight="bold" fill="white" text-anchor="middle">VT</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          }
        });
      });
    });
  }, [apiKey]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    if (selectedMarker) {
      selectedMarker.close();
    }

    const newMarkers: google.maps.Marker[] = [];

    properties.forEach(property => {
      // Generate random coordinates near DC Metro area for demo
      const lat = DC_METRO_CENTER.lat + (Math.random() - 0.5) * 0.2;
      const lng = DC_METRO_CENTER.lng + (Math.random() - 0.5) * 0.2;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: property.title,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="${selectedProperty?.id === property.id ? '#E87722' : '#630031'}" stroke="white" stroke-width="3"/>
              <text x="20" y="25" font-family="Arial" font-size="12" font-weight="bold" fill="white" text-anchor="middle">$${Math.floor(property.price)}</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20)
        }
      });

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
  }, [map, properties, selectedProperty, isLoaded]);

  if (showApiInput) {
    return (
      <Card className={`${className} flex items-center justify-center p-8`}>
        <CardContent className="text-center max-w-md">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Google Maps Integration</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enter your Google Maps API key to enable the interactive map view
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter Google Maps API Key"
              className="w-full px-3 py-2 border rounded-md"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button 
              onClick={() => setShowApiInput(false)}
              disabled={!apiKey}
              className="w-full"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Load Map
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Get your API key from the{' '}
            <a 
              href="https://console.cloud.google.com/google/maps-apis" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google Cloud Console
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
          onClick={() => setShowApiInput(true)}
        >
          <Zap className="h-4 w-4 mr-1" />
          API
        </Button>
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