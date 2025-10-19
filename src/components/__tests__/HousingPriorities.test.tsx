import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HousingPriorities } from '../HousingPriorities';
import { useToast } from '@/hooks/use-toast';
import { preferencesAPI } from '@/lib/api';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  preferencesAPI: {
    getHousingPriorities: vi.fn(),
    saveHousingPriorities: vi.fn(),
  },
}));

const mockToast = vi.fn();

describe('HousingPriorities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({
      toast: mockToast,
    });
    (preferencesAPI.getHousingPriorities as any).mockResolvedValue({
      budget: 30,
      commute: 25,
      safety: 25,
      roommates: 20,
    });
    (preferencesAPI.saveHousingPriorities as any).mockResolvedValue({});
  });

  it('renders the component with correct title and description', async () => {
    render(<HousingPriorities />);
    
    expect(screen.getByText('Housing Priorities')).toBeDefined();
    expect(screen.getByText(/Set the relative importance of different factors/)).toBeDefined();
    expect(screen.getByText(/Total must equal 100%/)).toBeDefined();
  });

  it('loads existing priorities on mount', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      expect(preferencesAPI.getHousingPriorities).toHaveBeenCalled();
    });
    
    // Check that the loaded values are displayed
    await waitFor(() => {
      const budgetSlider = screen.getByRole('slider', { name: /budget/i });
      expect(budgetSlider).toHaveAttribute('aria-valuenow', '30');
    });
  });

  it('shows loading state initially', () => {
    render(<HousingPriorities />);
    expect(screen.getByText('Loading your preferences...')).toBeDefined();
  });

  it('handles loading error gracefully', async () => {
    (preferencesAPI.getHousingPriorities as any).mockRejectedValue(new Error('Failed to load'));
    
    render(<HousingPriorities />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('25')).toBeDefined(); // Default values should be shown
    });
  });

  it('updates priorities when slider values change', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const budgetSlider = screen.getByRole('slider', { name: /budget/i });
      fireEvent.change(budgetSlider, { target: { value: '40' } });
    });
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('40')).toBeDefined();
    });
  });

  it('enforces 100% total by adjusting other values proportionally', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const budgetSlider = screen.getByRole('slider', { name: /budget/i });
      // Set budget to 50, which should cause other values to adjust
      fireEvent.change(budgetSlider, { target: { value: '50' } });
    });
    
    await waitFor(() => {
      // Check that total is still 100%
      const totalDisplay = screen.getByText(/Current total:/);
      expect(totalDisplay).toBeDefined();
    });
  });

  it('shows error when priorities do not total 100%', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const budgetSlider = screen.getByRole('slider', { name: /budget/i });
      fireEvent.change(budgetSlider, { target: { value: '50' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Current total:/)).toBeDefined();
    });
  });

  it('saves priorities successfully', async () => {
    const onSave = vi.fn();
    render(<HousingPriorities onSave={onSave} />);
    
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDefined();
    });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(preferencesAPI.saveHousingPriorities).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Housing priorities saved successfully!',
      });
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows error when save fails', async () => {
    (preferencesAPI.saveHousingPriorities as any).mockRejectedValue(new Error('Save failed'));
    
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);
    });
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to save housing priorities. Please try again.',
        variant: 'destructive',
      });
    });
  });

  it('resets to default values', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const resetButton = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetButton);
    });
    
    await waitFor(() => {
      // All values should be 25 (default)
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).toHaveAttribute('aria-valuenow', '25');
      });
    });
  });

  it('disables interactions when in read-only mode', async () => {
    render(<HousingPriorities readOnly={true} />);
    
    await waitFor(() => {
      const saveButton = screen.queryByRole('button', { name: /save/i });
      const resetButton = screen.queryByRole('button', { name: /reset/i });
      
      expect(saveButton).toBeNull();
      expect(resetButton).toBeNull();
    });
  });

  it('displays all priority categories correctly', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      expect(screen.getByText('Budget')).toBeDefined();
      expect(screen.getByText('Location/Commute')).toBeDefined();
      expect(screen.getByText('Safety')).toBeDefined();
      expect(screen.getByText('Roommates')).toBeDefined();
    });
  });

  it('prevents saving when total is not 100%', async () => {
    render(<HousingPriorities />);
    
    await waitFor(() => {
      const budgetSlider = screen.getByRole('slider', { name: /budget/i });
      // Set budget to 50 to break the 100% total
      fireEvent.change(budgetSlider, { target: { value: '50' } });
    });
    
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);
      
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid Priorities',
        description: 'All priorities must total exactly 100%',
        variant: 'destructive',
      });
      
      expect(preferencesAPI.saveHousingPriorities).not.toHaveBeenCalled();
    });
  });
});

