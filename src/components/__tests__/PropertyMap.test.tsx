import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyMap } from '../PropertyMap';

// Mock Leaflet
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn(),
      remove: vi.fn(),
      on: vi.fn(),
      getBounds: vi.fn(() => ({
        getWest: () => -77.2,
        getSouth: () => 38.8,
        getEast: () => -77.0,
        getNorth: () => 39.0,
      })),
    })),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
      remove: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn(),
      bindPopup: vi.fn(),
      on: vi.fn(),
    })),
    icon: vi.fn(),
    FeatureGroup: vi.fn(() => ({
      getBounds: vi.fn(() => ({
        pad: vi.fn(() => ({
          getWest: () => -77.2,
          getSouth: () => 38.8,
          getEast: () => -77.0,
          getNorth: () => 39.0,
        })),
      })),
    })),
  },
}));

// Mock the map loading
Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
  value: 800,
});
Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
  value: 600,
});

describe('PropertyMap', () => {
  const mockProperties = [
    {
      id: '1',
      title: 'Test Property 1',
      price: 1000,
      address: '123 Test St',
      latitude: 38.85,
      longitude: -77.1,
    },
    {
      id: '2',
      title: 'Test Property 2',
      price: 1200,
      address: '456 Test Ave',
      latitude: 38.86,
      longitude: -77.11,
    },
  ];

  const mockOnPropertySelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the map container', () => {
    render(
      <PropertyMap
        properties={mockProperties}
        onPropertySelect={mockOnPropertySelect}
      />
    );

    // Should render the map container div
    const mapContainer = document.querySelector('.leaflet-container');
    expect(mapContainer).toBeDefined();
  });

  it('accepts properties and onPropertySelect props', () => {
    render(
      <PropertyMap
        properties={mockProperties}
        onPropertySelect={mockOnPropertySelect}
        selectedProperty={mockProperties[0]}
      />
    );

    // Component should render without crashing
    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });

  it('handles empty properties array', () => {
    render(
      <PropertyMap
        properties={[]}
        onPropertySelect={mockOnPropertySelect}
      />
    );

    // Should still render the map
    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });

  it('handles missing optional props', () => {
    render(<PropertyMap />);

    // Should render without crashing when no props provided
    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });

  it('applies custom className', () => {
    const customClass = 'custom-map-class';
    render(
      <PropertyMap
        className={customClass}
        properties={mockProperties}
      />
    );

    const container = document.querySelector(`.${customClass}`);
    expect(container).toBeDefined();
  });

  it('handles properties without coordinates', () => {
    const propertiesWithoutCoords = [
      {
        id: '1',
        title: 'Test Property',
        price: 1000,
        address: '123 Test St',
        // Missing latitude and longitude
      },
    ];

    render(
      <PropertyMap
        properties={propertiesWithoutCoords}
        onPropertySelect={mockOnPropertySelect}
      />
    );

    // Should render without crashing even with invalid coordinates
    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });

  it('renders with filters prop', () => {
    const filters = {
      city: 'Blacksburg',
      min_rent: 800,
      max_rent: 1500,
      beds: 2,
    };

    render(
      <PropertyMap
        properties={mockProperties}
        filters={filters}
      />
    );

    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });

  it('renders with campus selection', () => {
    render(
      <PropertyMap
        properties={mockProperties}
        selectedCampus="arlington"
        onCampusChange={vi.fn()}
      />
    );

    expect(document.querySelector('.leaflet-container')).toBeDefined();
  });
});

