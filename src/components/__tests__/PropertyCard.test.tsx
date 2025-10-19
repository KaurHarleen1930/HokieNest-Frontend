import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyCard } from '../PropertyCard';
import { Listing } from '@/lib/api';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockListing: Listing = {
  id: '1',
  title: 'Beautiful Student Housing',
  price: 850,
  address: '123 Main St, Blacksburg, VA',
  beds: 2,
  baths: 1,
  intlFriendly: true,
  imageUrl: 'https://example.com/image.jpg',
  description: 'Great place for students',
  amenities: ['wifi', 'parking'],
  contactEmail: 'test@example.com',
  contactPhone: '555-0123',
};

const renderPropertyCard = (listing: Listing = mockListing) => {
  return render(
    <MemoryRouter>
      <PropertyCard listing={listing} />
    </MemoryRouter>
  );
};

describe('PropertyCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders listing information correctly', () => {
    const { getByText } = renderPropertyCard();
    
    expect(getByText('Beautiful Student Housing')).toBeDefined();
    expect(getByText('$850/mo')).toBeDefined();
    expect(getByText('123 Main St, Blacksburg, VA')).toBeDefined();
    expect(getByText('2 beds')).toBeDefined();
    expect(getByText('1 bath')).toBeDefined();
  });

  it('shows international friendly badge when applicable', () => {
    const { getByText } = renderPropertyCard();
    
    expect(getByText('Intl Friendly')).toBeDefined();
  });

  it('does not show international friendly badge when not applicable', () => {
    const nonIntlListing = { ...mockListing, intlFriendly: false };
    const { queryByText } = renderPropertyCard(nonIntlListing);
    
    expect(queryByText('Intl Friendly')).toBeNull();
  });

  it('has proper test attributes', () => {
    const { getByTestId } = renderPropertyCard();
    
    expect(getByTestId('listing-card')).toBeDefined();
    expect(getByTestId('price')).toBeDefined();
    expect(getByTestId('view-details')).toBeDefined();
  });

  it('formats price with commas for large numbers', () => {
    const expensiveListing = { ...mockListing, price: 2500 };
    const { getByText } = renderPropertyCard(expensiveListing);
    
    expect(getByText('$2,500/mo')).toBeDefined();
  });
});