import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access auth context
const TestComponent = () => {
  const { user, login, logout, isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      {user && <div data-testid="user-name">{user.name}</div>}
      <button onClick={() => login('test@vt.edu', 'password')}>
        Login
      </button>
      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
};

const renderWithAuth = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Auth Context', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockClear();
  });

  it('starts with unauthenticated state', async () => {
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });
  });

  it('handles successful login', async () => {
    const mockUser = {
      id: '1',
      email: 'test@vt.edu',
      name: 'Test User',
      role: 'student' as const,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fake-token',
        user: mockUser,
      }),
    });

    renderWithAuth();

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });

    expect(localStorage.getItem('auth_token')).toBe('fake-token');
  });

  it('handles login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Invalid credentials',
      }),
    });

    renderWithAuth();

    const loginButton = screen.getByText('Login');
    
    await expect(async () => {
      fireEvent.click(loginButton);
      await waitFor(() => {});
    }).rejects.toThrow();
  });

  it('handles logout correctly', async () => {
    // Set up authenticated state
    localStorage.setItem('auth_token', 'fake-token');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '1',
        email: 'test@vt.edu',
        name: 'Test User',
        role: 'student',
      }),
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('validates existing token on mount', async () => {
    localStorage.setItem('auth_token', 'valid-token');

    const mockUser = {
      id: '1',
      email: 'test@vt.edu',
      name: 'Test User',
      role: 'student' as const,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
  });

  it('clears invalid token on mount', async () => {
    localStorage.setItem('auth_token', 'invalid-token');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid token' }),
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});