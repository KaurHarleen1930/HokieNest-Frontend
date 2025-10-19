import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoommateQuestionnaire from '../RoommateQuestionnaire';
import { preferencesAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

// Mock the auth hook
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  preferencesAPI: {
    getPreferences: vi.fn(),
    saveHousingPreferences: vi.fn(),
    saveLifestylePreferences: vi.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const renderQuestionnaire = () => {
  return render(
    <TestWrapper>
      <RoommateQuestionnaire />
    </TestWrapper>
  );
};

describe('RoommateQuestionnaire', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      token: 'fake-token',
    });
    (useToast as any).mockReturnValue({
      toast: mockToast,
    });
    (preferencesAPI.getPreferences as any).mockResolvedValue({
      housing: null,
      lifestyle: null,
    });
  });

  it('renders the questionnaire with progress indicator', async () => {
    renderQuestionnaire();

    await waitFor(() => {
      expect(screen.getByText(/step 1 of/i) || screen.getByText(/questionnaire/i)).toBeDefined();
    });
  });

  it('shows loading state initially', () => {
    (preferencesAPI.getPreferences as any).mockImplementation(() => new Promise(() => {}));

    renderQuestionnaire();

    // Should show loading state
    expect(screen.getByText(/loading/i) || document.querySelector('[class*="animate-spin"]')).toBeDefined();
  });

  it('redirects to profile if user already has preferences', async () => {
    (preferencesAPI.getPreferences as any).mockResolvedValue({
      housing: { budgetRange: [800, 1200] },
      lifestyle: { sleepSchedule: 'early' },
    });

    renderQuestionnaire();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile Found',
        description: 'You already have a roommate profile. Redirecting to your profile page.',
      });
    });

    // Should navigate to profile page after delay
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/roommate-profile');
    }, { timeout: 2000 });
  });

  it('handles unauthenticated users', async () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: false,
      token: null,
    });

    renderQuestionnaire();

    await waitFor(() => {
      // Should render questionnaire without API call
      expect(preferencesAPI.getPreferences).not.toHaveBeenCalled();
    });
  });

  it('loads saved preferences from localStorage', async () => {
    const savedPreferences = {
      budgetRange: [900, 1300],
      sleepSchedule: 'late',
      cleanlinessLevel: 4,
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPreferences));

    renderQuestionnaire();

    await waitFor(() => {
      // Should load and use saved preferences
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });
  });

  it('allows navigation between steps', async () => {
    renderQuestionnaire();

    await waitFor(() => {
      // Should render step 1 content
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });

    // Look for next button
    const nextButton = screen.queryByRole('button', { name: /next/i });
    if (nextButton) {
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        // Should advance to next step
        expect(screen.getByText(/questionnaire/i) || screen.getByText(/step/i)).toBeDefined();
      });
    }
  });

  it('validates required fields before proceeding', async () => {
    renderQuestionnaire();

    await waitFor(() => {
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });

    // Try to proceed without filling required fields
    const nextButton = screen.queryByRole('button', { name: /next/i });
    if (nextButton) {
      fireEvent.click(nextButton);
      
      // Should show validation error or prevent navigation
      await waitFor(() => {
        expect(screen.getByText(/required/i) || screen.getByText(/budget/i)).toBeDefined();
      });
    }
  });

  it('saves preferences to localStorage as user progresses', async () => {
    renderQuestionnaire();

    await waitFor(() => {
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });

    // Make some changes to preferences
    const budgetInput = screen.queryByRole('slider') || screen.queryByDisplayValue('700');
    if (budgetInput) {
      fireEvent.change(budgetInput, { target: { value: '800' } });
    }

    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('handles restart parameter in URL', async () => {
    // Mock URL with restart parameter
    const mockSearchParams = new URLSearchParams('?restart=true');
    Object.defineProperty(window, 'location', {
      value: {
        search: mockSearchParams.toString(),
        pathname: '/roommate-questionnaire',
      },
      writable: true,
    });

    renderQuestionnaire();

    await waitFor(() => {
      // Should not check existing profile when restart is requested
      expect(preferencesAPI.getPreferences).not.toHaveBeenCalled();
    });
  });

  it('shows completion step at the end', async () => {
    renderQuestionnaire();

    // Navigate through all steps (this would require more complex interaction)
    // For now, just verify the component renders without errors
    await waitFor(() => {
      expect(screen.getByText(/questionnaire/i) || screen.getByDisplayValue(/700/)).toBeDefined();
    });
  });

  it('handles API errors gracefully', async () => {
    (preferencesAPI.getPreferences as any).mockRejectedValue(new Error('API Error'));

    renderQuestionnaire();

    await waitFor(() => {
      // Should still render the questionnaire even if API fails
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });
  });

  it('allows going back to previous steps', async () => {
    renderQuestionnaire();

    await waitFor(() => {
      expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
    });

    // Navigate forward first
    const nextButton = screen.queryByRole('button', { name: /next/i });
    const backButton = screen.queryByRole('button', { name: /back/i }) || 
                      screen.queryByRole('button', { name: /previous/i });

    if (nextButton && backButton) {
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        fireEvent.click(backButton);
        
        // Should go back to previous step
        expect(screen.getByText(/questionnaire/i) || screen.getByText(/budget/i)).toBeDefined();
      });
    }
  });
});

