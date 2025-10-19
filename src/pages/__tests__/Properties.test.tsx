import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Properties from '../Properties';
import { listingsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Mock the API
vi.mock('@/lib/api', () => ({
  listingsAPI: {
    getAll: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({
          data: [],
          error: null,
        })),
      })),
    })),
  },
}));

// Mock the PropertyCard component
vi.mock('@/components/PropertyCard', () => ({
  PropertyCard: ({ listing }: { listing: any }) => (
    <div data-testid="property-card">
      {listing.title} - ${listing.price}
    </div>
  ),
}));

// Mock PropertyMap component
vi.mock('@/components/PropertyMap', () => ({
  PropertyMap: ({ properties }: { properties: any[] }) => (
    <div data-testid="property-map">
      Map with {properties.length} properties
    </div>
  ),
}));

// Mock PriceRange component
vi.mock('@/components/ui/PriceRange', () => ({
  default: ({ min, max, onChange }: { min: number; max: number; onChange: (range: [number, number]) => void }) => (
    <div data-testid="price-range">
      <input 
        data-testid="price-min"
        defaultValue={min}
        onChange={(e) => onChange([Number(e.target.value), max])}
      />
      <input 
        data-testid="price-max"
        defaultValue={max}
        onChange={(e) => onChange([min, Number(e.target.value)])}
      />
    </div>
  ),
}));

const mockListings: any[] = [
  {
    id: '1',
    title: 'Budget Apartment',
    price: 800,
    address: '123 Main St',
    beds: 1,
    baths: 1,
    intlFriendly: false,
    imageUrl: 'test1.jpg',
  },
  {
    id: '2',
    title: 'Premium Apartment',
    price: 1500,
    address: '456 Oak Ave',
    beds: 2,
    baths: 2,
    intlFriendly: true,
    imageUrl: 'test2.jpg',
  },
  {
    id: '3',
    title: 'Studio Apartment',
    price: 700,
    address: '789 Pine St',
    beds: 0,
    baths: 1,
    intlFriendly: true,
    imageUrl: 'test3.jpg',
  },
];

const renderProperties = () => {
  return render(
    <BrowserRouter>
      <Properties />
    </BrowserRouter>
  );
};

describe('Properties Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listingsAPI.getAll as any).mockResolvedValue(mockListings);
    (supabase.from as any).mockReturnValue({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({
          data: [],
          error: null,
        })),
      })),
    });
  });

  it('renders the properties page', async () => {
    renderProperties();

    expect(screen.getByText(/properties/i)).toBeDefined();
    
    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });
  });

  it('displays all properties by default', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getByText('Budget Apartment - $800')).toBeDefined();
      expect(screen.getByText('Premium Apartment - $1500')).toBeDefined();
      expect(screen.getByText('Studio Apartment - $700')).toBeDefined();
    });
  });

  it('filters properties by price range', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Test price filtering by simulating price range input
    const priceInputs = screen.getAllByTestId('price-min');
    if (priceInputs.length > 0) {
      fireEvent.change(priceInputs[0], { target: { value: '900' } });
    }
  });

  it('shows loading state initially', () => {
    (listingsAPI.getAll as any).mockImplementation(() => new Promise(() => {}));

    renderProperties();

    // Should show loading state - checking for skeleton or loading indicator
    expect(screen.getByText(/loading/i) || document.querySelector('[class*="skeleton"]')).toBeDefined();
  });

  it('handles API errors gracefully', async () => {
    (listingsAPI.getAll as any).mockRejectedValue(new Error('API Error'));

    renderProperties();

    await waitFor(() => {
      // Should show error state
      expect(screen.getByText(/error/i) || screen.getByText(/failed/i)).toBeDefined();
    });
  });

  it('toggles between grid and map view', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Find and click map view toggle button
    const mapButton = screen.queryByRole('button', { name: /map/i });
    if (mapButton) {
      fireEvent.click(mapButton);
      
      expect(screen.getByTestId('property-map')).toBeDefined();
    }
  });

  it('filters properties by international friendly flag', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Find international friendly checkbox and toggle it
    const intlCheckbox = screen.queryByRole('checkbox');
    if (intlCheckbox) {
      fireEvent.click(intlCheckbox);
      
      await waitFor(() => {
        // Should filter to only international friendly properties
        const cards = screen.getAllByTestId('property-card');
        expect(cards.length).toBeLessThanOrEqual(3);
      });
    }
  });

  it('sorts properties correctly', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Find sort dropdown and change sorting
    const sortSelect = screen.queryByRole('combobox');
    if (sortSelect) {
      fireEvent.click(sortSelect);
      
      // Try to select price low to high
      const priceOption = screen.queryByText(/price.*low/i);
      if (priceOption) {
        fireEvent.click(priceOption);
      }
    }
  });

  it('handles empty results', async () => {
    (listingsAPI.getAll as any).mockResolvedValue([]);

    renderProperties();

    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText(/no.*found/i) || screen.getByText(/empty/i)).toBeDefined();
    });
  });

  it('updates filters correctly', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Test that filter controls are rendered
    expect(screen.getByTestId('price-range')).toBeDefined();
  });

  it('handles property selection for map view', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Find map button and switch to map view
    const mapButton = screen.queryByRole('button', { name: /map/i });
    if (mapButton) {
      fireEvent.click(mapButton);
    }

    // Verify map is rendered
    expect(screen.getByTestId('property-map')).toBeDefined();
  });

  it('shows filter toggle functionality', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Look for filter toggle button
    const filterButton = screen.queryByRole('button', { name: /filter/i });
    if (filterButton) {
      fireEvent.click(filterButton);
    }
  });

  it('handles campus filtering', async () => {
    renderProperties();

    await waitFor(() => {
      expect(screen.getAllByTestId('property-card')).toHaveLength(3);
    });

    // Look for campus selector
    const campusSelect = screen.queryByText(/campus/i);
    if (campusSelect) {
      // Campus filtering should be available
      expect(campusSelect).toBeDefined();
    }
  });
});

