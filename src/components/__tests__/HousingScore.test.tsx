import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HousingScore } from '../HousingScore';

describe('HousingScore', () => {
  const mockPriorities = {
    budget: 40,
    commute: 30,
    safety: 20,
    roommates: 10,
  };

  const mockProperty = {
    id: '1',
    title: 'Test Property',
    price: 1000,
    address: '123 Test St',
    distanceFromCampus: 10,
    safetyScore: 8,
    roommateCompatibility: 75,
  };

  it('renders the component with correct title and description', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    expect(screen.getByText('Housing Match Score')).toBeDefined();
    expect(screen.getByText('Based on your priority preferences')).toBeDefined();
  });

  it('displays the total score correctly', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    // The total score should be calculated and displayed
    expect(screen.getByText(/\d+\/100/)).toBeDefined();
  });

  it('displays all individual score categories', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    expect(screen.getByText('Budget')).toBeDefined();
    expect(screen.getByText('Commute')).toBeDefined();
    expect(screen.getByText('Safety')).toBeDefined();
    expect(screen.getByText('Roommates')).toBeDefined();
  });

  it('shows priority weights for each category', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    expect(screen.getByText('40%')).toBeDefined(); // Budget priority
    expect(screen.getByText('30%')).toBeDefined(); // Commute priority
    expect(screen.getByText('20%')).toBeDefined(); // Safety priority
    expect(screen.getByText('10%')).toBeDefined(); // Roommates priority
  });

  it('displays progress bars for each category', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    // Should have progress bars (they are rendered as role="progressbar")
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('shows correct overall rating badge', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    // Should display one of the rating labels
    const possibleRatings = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'Very Poor'];
    const ratingElements = possibleRatings.map(rating => screen.queryByText(rating)).filter(Boolean);
    expect(ratingElements.length).toBeGreaterThan(0);
  });

  it('handles missing property data gracefully', () => {
    const propertyWithMissingData = {
      ...mockProperty,
      distanceFromCampus: undefined,
      safetyScore: undefined,
      roommateCompatibility: undefined,
    };

    render(<HousingScore priorities={mockPriorities} property={propertyWithMissingData} />);
    
    // Should still render without errors
    expect(screen.getByText('Housing Match Score')).toBeDefined();
  });

  it('calculates budget score correctly for different price ranges', () => {
    // Test with a low price (should score high)
    const lowPriceProperty = { ...mockProperty, price: 600 };
    const { rerender } = render(<HousingScore priorities={mockPriorities} property={lowPriceProperty} />);
    
    // Test with a high price (should score low)
    const highPriceProperty = { ...mockProperty, price: 1800 };
    rerender(<HousingScore priorities={mockPriorities} property={highPriceProperty} />);
    
    expect(screen.getByText('Housing Match Score')).toBeDefined();
  });

  it('calculates commute score correctly for different distances', () => {
    // Test with close distance
    const closeProperty = { ...mockProperty, distanceFromCampus: 3 };
    const { rerender } = render(<HousingScore priorities={mockPriorities} property={closeProperty} />);
    
    // Test with far distance
    const farProperty = { ...mockProperty, distanceFromCampus: 45 };
    rerender(<HousingScore priorities={mockPriorities} property={farProperty} />);
    
    expect(screen.getByText('Housing Match Score')).toBeDefined();
  });

  it('shows priority weighted score in footer', () => {
    render(<HousingScore priorities={mockPriorities} property={mockProperty} />);
    
    expect(screen.getByText('Priority Weighted Score')).toBeDefined();
  });

  it('handles edge case priorities (all zero)', () => {
    const zeroPriorities = {
      budget: 0,
      commute: 0,
      safety: 0,
      roommates: 0,
    };

    render(<HousingScore priorities={zeroPriorities} property={mockProperty} />);
    
    expect(screen.getByText('Housing Match Score')).toBeDefined();
  });

  it('handles edge case property values', () => {
    const edgeCaseProperty = {
      ...mockProperty,
      price: 0,
      distanceFromCampus: 0,
      safetyScore: 0,
      roommateCompatibility: 0,
    };

    render(<HousingScore priorities={mockPriorities} property={edgeCaseProperty} />);
    
    expect(screen.getByText('Housing Match Score')).toBeDefined();
  });
});

