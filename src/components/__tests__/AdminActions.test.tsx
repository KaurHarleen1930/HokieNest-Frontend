import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Admin from '../../pages/Admin';
import { AuthProvider } from '@/lib/auth';
import { usersAPI } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  usersAPI: {
    getAll: vi.fn(),
    suspend: vi.fn(),
  },
}));

// Mock auth hook
const mockAuthContext = {
  user: {
    id: 'admin-id',
    email: 'admin@vt.edu',
    name: 'Admin User',
    role: 'admin' as const,
  },
  isAuthenticated: true,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
  token: 'admin-token',
};

vi.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext,
}));

const mockUsers = [
  {
    id: 'admin-id',
    email: 'admin@vt.edu',
    name: 'Admin User',
    role: 'admin' as const,
    suspended: false,
  },
  {
    id: 'student-id',
    email: 'student@vt.edu',
    name: 'Student User',
    role: 'student' as const,
    suspended: false,
  },
  {
    id: 'staff-id',
    email: 'staff@vt.edu',
    name: 'Staff User',
    role: 'staff' as const,
    suspended: false,
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
        <AuthProvider>
          {component}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Admin Actions', () => {
  beforeEach(() => {
    vi.mocked(usersAPI.getAll).mockResolvedValue(mockUsers);
    vi.mocked(usersAPI.suspend).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays user list for admin', async () => {
    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Student User')).toBeInTheDocument();
      expect(screen.getByText('Staff User')).toBeInTheDocument();
    });
  });

  it('shows suspend button for non-admin users only', async () => {
    renderWithProviders(<Admin />);

    await waitFor(() => {
      // Should have suspend buttons for student and staff
      const suspendButtons = screen.getAllByText('Suspend');
      expect(suspendButtons).toHaveLength(2);
      
      // Admin row should show "You" instead of suspend button
      expect(screen.getByText('You')).toBeInTheDocument();
    });
  });

  it('hides admin actions for non-admin users', async () => {
    // Mock non-admin user
    const nonAdminContext = {
      ...mockAuthContext,
      user: {
        id: 'student-id',
        email: 'student@vt.edu',
        name: 'Student User',
        role: 'student' as const,
      },
    };

    vi.mocked(require('@/lib/auth').useAuth).mockReturnValue(nonAdminContext);

    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });
  });

  it('successfully suspends a user', async () => {
    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('Student User')).toBeInTheDocument();
    });

    // Find and click suspend button for student
    const suspendButton = screen.getByTestId('suspend-user-student-id');
    fireEvent.click(suspendButton);

    await waitFor(() => {
      expect(usersAPI.suspend).toHaveBeenCalledWith('student-id');
    });
  });

  it('handles suspend error gracefully', async () => {
    vi.mocked(usersAPI.suspend).mockRejectedValue(new Error('Suspend failed'));

    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('Student User')).toBeInTheDocument();
    });

    const suspendButton = screen.getByTestId('suspend-user-student-id');
    fireEvent.click(suspendButton);

    await waitFor(() => {
      expect(usersAPI.suspend).toHaveBeenCalledWith('student-id');
    });
  });

  it('shows correct user counts in stats', async () => {
    const mixedUsers = [
      ...mockUsers,
      {
        id: 'suspended-user',
        email: 'suspended@vt.edu',
        name: 'Suspended User',
        role: 'student' as const,
        suspended: true,
      },
    ];

    vi.mocked(usersAPI.getAll).mockResolvedValue(mixedUsers);

    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument(); // Total users
      expect(screen.getByText('3')).toBeInTheDocument(); // Active users
      expect(screen.getByText('1')).toBeInTheDocument(); // Suspended users
    });
  });
});