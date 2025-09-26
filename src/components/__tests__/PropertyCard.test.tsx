import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PropertyCard } from '../PropertyCard';
import { Listing } from '@/lib/api';

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockListing: Listing = {
  id: '1',
  title: 'Test Property',
  price: 1200,
  address: '123 Test St, Blacksburg, VA',
  beds: 2,
  baths: 1,
  intlFriendly: true,
  imageUrl: 'https://example.com/image.jpg',
  description: 'Test description',
  amenities: ['wifi', 'parking'],
  contactEmail: 'test@example.com',
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('PropertyCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders property information correctly', () => {
    renderWithRouter(<PropertyCard listing={mockListing} />);

    expect(screen.getByTestId('listing-card')).toBeInTheDocument();
    expect(screen.getByText('Test Property')).toBeInTheDocument();
    expect(screen.getByTestId('price')).toHaveTextContent('$1,200/mo');
    expect(screen.getByText('123 Test St, Blacksburg, VA')).toBeInTheDocument();
    expect(screen.getByText('2 beds')).toBeInTheDocument();
    expect(screen.getByText('1 bath')).toBeInTheDocument();
  });

  it('shows international friendly badge when applicable', () => {
    renderWithRouter(<PropertyCard listing={mockListing} />);
    expect(screen.getByText('Intl Friendly')).toBeInTheDocument();
  });

  it('does not show international friendly badge when not applicable', () => {
    const nonIntlListing = { ...mockListing, intlFriendly: false };
    renderWithRouter(<PropertyCard listing={nonIntlListing} />);
    expect(screen.queryByText('Intl Friendly')).not.toBeInTheDocument();
  });

  it('navigates to property detail when view details is clicked', () => {
    renderWithRouter(<PropertyCard listing={mockListing} />);
    
    const viewDetailsButton = screen.getByTestId('view-details');
    fireEvent.click(viewDetailsButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/properties/1');
  });

  it('handles plural beds and baths correctly', () => {
    const pluralListing = { ...mockListing, beds: 3, baths: 2 };
    renderWithRouter(<PropertyCard listing={pluralListing} />);
    
    expect(screen.getByText('3 beds')).toBeInTheDocument();
    expect(screen.getByText('2 baths')).toBeInTheDocument();
  });

  it('handles singular bed and bath correctly', () => {
    const singularListing = { ...mockListing, beds: 1, baths: 1 };
    renderWithRouter(<PropertyCard listing={singularListing} />);
    
    expect(screen.getByText('1 bed')).toBeInTheDocument();
    expect(screen.getByText('1 bath')).toBeInTheDocument();
  });
});