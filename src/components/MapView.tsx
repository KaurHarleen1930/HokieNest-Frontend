import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Navigation, Zap, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Declare global google types
declare global {
    interface Window {
        google: typeof google;
    }
}

interface Property {
    id: string;
    title: string;
    price: number;
    address: string;
    beds: number;
    baths: number;
    intlFriendly: boolean;
    imageUrl: string;
    description?: string;
    amenities?: string[];
    contactEmail?: string;
    contactPhone?: string;
    latitude?: number | null;
    longitude?: number | null;
    city?: string;
    state?: string;
}

interface MapViewProps {
    properties: Property[];
    onPropertySelect?: (property: Property) => void;
    selectedProperty?: Property;
    className?: string;
}

export function MapView({
    properties,
    onPropertySelect,
    selectedProperty,
    className = ""
}: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
    const [selectedMarker, setSelectedMarker] = useState<google.maps.InfoWindow | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

    // Blacksburg, VA center (VT main campus area)
    const BLACKSBURG_CENTER = { lat: 37.2296, lng: -80.4139 };

    // VT Campus locations
    const VT_CAMPUSES = [
        { name: 'VT Main Campus', lat: 37.2296, lng: -80.4139 },
        { name: 'VT Alexandria Campus', lat: 38.8051, lng: -77.0470 },
        { name: 'VT Arlington Campus', lat: 38.8816, lng: -77.1025 }
    ];

    useEffect(() => {
        if (!mapRef.current) return;

        if (apiKey) {
            // Load Google Maps if API key is available
            const loader = new Loader({
                apiKey: apiKey,
                version: 'weekly',
                libraries: ['places', 'geometry']
            });

            loader.load().then(() => {
                const googleMap = new google.maps.Map(mapRef.current!, {
                    center: BLACKSBURG_CENTER,
                    zoom: 12,
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
        } else {
            // Show simple map view without Google Maps API
            setIsLoaded(true);
        }
    }, [apiKey]);

    // Update markers when properties change
    useEffect(() => {
        if (!map || !isLoaded) return;

        // Clear existing markers
        markers.forEach(marker => marker.setMap(null));
        if (selectedMarker) {
            selectedMarker.close();
        }

        const newMarkers: google.maps.Marker[] = [];

        properties.forEach(property => {
            // Use actual coordinates if available, otherwise use random coordinates near Blacksburg
            const lat = property.latitude || (BLACKSBURG_CENTER.lat + (Math.random() - 0.5) * 0.1);
            const lng = property.longitude || (BLACKSBURG_CENTER.lng + (Math.random() - 0.5) * 0.1);

            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: property.title,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2C11.716 2 5 8.716 5 17c0 10 15 28 15 28s15-18 15-28c0-8.284-6.716-15-15-15z" fill="${selectedProperty?.id === property.id ? '#E87722' : '#630031'}" stroke="white" stroke-width="3"/>
              <text x="20" y="22" font-family="Arial" font-size="10" font-weight="bold" fill="white" text-anchor="middle">$${Math.floor(property.price)}</text>
            </svg>
          `),
                    scaledSize: new google.maps.Size(40, 50),
                    anchor: new google.maps.Point(20, 48)
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

    // Simple map view without Google Maps API
    if (!apiKey) {
        return (
            <Card className={`${className} flex flex-col`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Property Locations</h3>
                        <Badge variant="secondary" className="text-xs">
                            {properties.length} properties
                        </Badge>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {properties.slice(0, 10).map((property, index) => (
                            <div
                                key={property.id}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedProperty?.id === property.id
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                onClick={() => onPropertySelect?.(property)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                                            <Building className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">{property.title}</h4>
                                        <p className="text-xs text-gray-600 truncate">{property.address}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-medium text-orange-600">${property.price}/mo</span>
                                            {property.city && (
                                                <span className="text-xs text-gray-500">• {property.city}, {property.state}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {properties.length > 10 && (
                            <div className="text-center text-sm text-gray-500 py-2">
                                +{properties.length - 10} more properties
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                            <MapPin className="w-4 h-4" />
                            <span>Add Google Maps API key for interactive map view</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <div ref={mapRef} className="w-full h-full rounded-lg" />

            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading map...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
