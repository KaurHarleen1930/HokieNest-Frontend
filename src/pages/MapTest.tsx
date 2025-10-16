import React, { useState, useEffect } from 'react';
import { MapView } from '@/components/MapView';
import { PropertyCard } from '@/components/PropertyCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Grid3X3 } from 'lucide-react';

// Sample property data for testing
const SAMPLE_PROPERTIES = [
    {
        id: '1',
        title: 'Modern 2BR Apartment Near VT Campus',
        price: 1200,
        address: '123 College Ave, Blacksburg, VA 24060',
        beds: 2,
        baths: 1,
        intlFriendly: true,
        imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
        description: 'Beautiful modern apartment with updated kitchen and spacious living areas.',
        amenities: ['wifi', 'parking', 'utilities'],
        contactEmail: 'landlord1@example.com',
        contactPhone: '(540) 555-0101',
        latitude: 37.2296,
        longitude: -80.4139,
        city: 'Blacksburg',
        state: 'VA'
    },
    {
        id: '2',
        title: 'Cozy Studio in Historic Downtown',
        price: 800,
        address: '456 Main St, Blacksburg, VA 24060',
        beds: 1,
        baths: 1,
        intlFriendly: true,
        imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
        description: 'Charming studio apartment in the heart of downtown Blacksburg.',
        amenities: ['wifi', 'security'],
        contactEmail: 'landlord2@example.com',
        latitude: 37.2300,
        longitude: -80.4140,
        city: 'Blacksburg',
        state: 'VA'
    },
    {
        id: '3',
        title: 'Spacious 3BR House with Yard',
        price: 1800,
        address: '789 University Dr, Blacksburg, VA 24060',
        beds: 3,
        baths: 2,
        intlFriendly: false,
        imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
        description: 'Large house perfect for group living with big backyard.',
        amenities: ['parking', 'utilities'],
        contactEmail: 'landlord3@example.com',
        contactPhone: '(540) 555-0103',
        latitude: 37.2280,
        longitude: -80.4120,
        city: 'Blacksburg',
        state: 'VA'
    },
    {
        id: '4',
        title: 'International Student Friendly 1BR',
        price: 900,
        address: '321 Global Way, Blacksburg, VA 24060',
        beds: 1,
        baths: 1,
        intlFriendly: true,
        imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        description: 'Perfect for international students with furnished options.',
        amenities: ['wifi', 'security', 'utilities'],
        contactEmail: 'intl.housing@example.com',
        latitude: 37.2310,
        longitude: -80.4150,
        city: 'Blacksburg',
        state: 'VA'
    },
    {
        id: '5',
        title: 'Luxury 2BR with Pool Access',
        price: 1500,
        address: '555 Luxury Ln, Blacksburg, VA 24060',
        beds: 2,
        baths: 2,
        intlFriendly: true,
        imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
        description: 'Upscale apartment complex with pool, gym, and study rooms.',
        amenities: ['wifi', 'parking', 'security'],
        contactEmail: 'luxury@example.com',
        contactPhone: '(540) 555-0105',
        latitude: 37.2270,
        longitude: -80.4110,
        city: 'Blacksburg',
        state: 'VA'
    }
];

export default function MapTest() {
    const [properties] = useState(SAMPLE_PROPERTIES);
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2">Map Test</h1>
                        <p className="text-muted">
                            Testing Google Maps integration with property data
                        </p>
                    </div>

                    <div className="flex items-center gap-3 mt-4 md:mt-0">
                        <div className="flex items-center border border-surface-3 rounded-lg p-1">
                            <Button
                                variant={viewMode === "grid" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("grid")}
                                className="h-8"
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === "map" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("map")}
                                className="h-8"
                            >
                                <MapPin className="h-4 w-4" />
                            </Button>
                        </div>
                        <Badge variant="muted">
                            {properties.filter(p => p.intlFriendly).length} International Friendly
                        </Badge>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Map/Grid View */}
                    <div className="flex-1">
                        {viewMode === "grid" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {properties.map((property) => (
                                    <PropertyCard
                                        key={property.id}
                                        listing={property}
                                        className={selectedProperty?.id === property.id ? "ring-2 ring-accent" : ""}
                                        onClick={() => setSelectedProperty(property)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                                <div className="lg:col-span-2">
                                    <MapView
                                        properties={properties}
                                        selectedProperty={selectedProperty}
                                        onPropertySelect={setSelectedProperty}
                                        className="h-full"
                                    />
                                </div>
                                <div className="space-y-4 overflow-y-auto">
                                    <h3 className="font-semibold text-lg">Properties ({properties.length})</h3>
                                    {properties.map((property) => (
                                        <PropertyCard
                                            key={property.id}
                                            listing={property}
                                            className={`cursor-pointer transition-all ${selectedProperty?.id === property.id ? "ring-2 ring-accent shadow-lg" : "hover:shadow-md"
                                                }`}
                                            onClick={() => setSelectedProperty(property)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selected Property Details */}
                    {selectedProperty && (
                        <div className="lg:w-80">
                            <Card className="sticky top-4">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <MapPin className="h-5 w-5" />
                                        Selected Property
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <PropertyCard
                                        listing={selectedProperty}
                                        className="border-0 shadow-none"
                                    />
                                    <div className="mt-4 space-y-2">
                                        <Button
                                            className="w-full"
                                            onClick={() => setSelectedProperty(null)}
                                        >
                                            Clear Selection
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
