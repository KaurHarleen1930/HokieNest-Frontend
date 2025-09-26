import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Properties from '../Properties';
import { listingsAPI } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  listingsAPI: {
    getAll: vi.fn(),
  },
}));

const mockListings = [
  {
    id: '1',
    title: 'Test Property 1',
    price: 1200,
    address: '123 Test St',
    beds: 2,
    baths: 1,
    intlFriendly: true,
    imageUrl: 'https://example.com/1.jpg',
  },
  {
    id: '2',
    title: 'Test Property 2',
    price: 800,
    address: '456 Test Ave',
    beds: 1,
    baths: 1,
    intlFriendly: false,
    imageUrl: 'https://example.com/2.jpg',
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Properties Page', () => {
  beforeEach(() => {
    vi.mocked(listingsAPI.getAll).mockResolvedValue(mockListings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders properties list correctly', async () => {
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('Test Property 1')).toBeInTheDocument();
      expect(screen.getByText('Test Property 2')).toBeInTheDocument();
    });

    expect(screen.getByText('2 properties available')).toBeInTheDocument();
    expect(screen.getByText('1 International Friendly')).toBeInTheDocument();
  });

  it('shows empty state when no properties found', async () => {
    vi.mocked(listingsAPI.getAll).mockResolvedValue([]);
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('No properties found')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    vi.mocked(listingsAPI.getAll).mockRejectedValue(new Error('API Error'));
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load properties')).toBeInTheDocument();
    });
  });

  it('applies filters correctly', async () => {
    renderWithProviders(<Properties />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Property 1')).toBeInTheDocument();
    });

    // Open filters
    const filtersButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filtersButton);

    // Set min price filter
    const minPriceInput = screen.getByLabelText('Min');
    fireEvent.change(minPriceInput, { target: { value: '1000' } });

    // Apply filters
    const applyButton = screen.getByRole('button', { name: /apply filters/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(listingsAPI.getAll).toHaveBeenCalledWith({ minPrice: 1000 });
    });
  });

  it('clears filters correctly', async () => {
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('Test Property 1')).toBeInTheDocument();
    });

    // Open filters and set some values
    const filtersButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filtersButton);

    const minPriceInput = screen.getByLabelText('Min');
    fireEvent.change(minPriceInput, { target: { value: '1000' } });

    const intlCheckbox = screen.getByLabelText('International Student Friendly');
    fireEvent.click(intlCheckbox);

    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(listingsAPI.getAll).toHaveBeenCalledWith({});
    });
  });

  it('displays correct property count', async () => {
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('2 properties available')).toBeInTheDocument();
    });
  });

  it('displays correct international friendly count', async () => {
    renderWithProviders(<Properties />);

    await waitFor(() => {
      expect(screen.getByText('1 International Friendly')).toBeInTheDocument();
    });
  });
});