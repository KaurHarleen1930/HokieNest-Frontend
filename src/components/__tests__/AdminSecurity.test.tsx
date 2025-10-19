import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock the auth hook
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

const MockAdminContent = () => <div data-testid="admin-content">Admin Dashboard</div>;

const renderProtectedRoute = (user: any = null) => {
  (useAuth as any).mockReturnValue({
    user,
    isAuthenticated: !!user,
    loading: false,
  });

  return render(
    <MemoryRouter>
      <ProtectedRoute requiredRole="admin">
        <MockAdminContent />
      </ProtectedRoute>
    </MemoryRouter>
  );
};

describe('Admin Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access to unauthenticated users', () => {
    const { queryByTestId } = renderProtectedRoute(null);
    
    expect(queryByTestId('admin-content')).toBeNull();
  });

  it('denies access to student users', () => {
    const studentUser = {
      id: '1',
      email: 'student@vt.edu',
      name: 'Student User',
      role: 'student',
    };
    
    const { queryByTestId, getByText } = renderProtectedRoute(studentUser);
    
    expect(queryByTestId('admin-content')).toBeNull();
    expect(getByText('Access Denied')).toBeDefined();
  });

  it('denies access to staff users', () => {
    const staffUser = {
      id: '2',
      email: 'staff@vt.edu',
      name: 'Staff User',
      role: 'staff',
    };
    
    const { queryByTestId, getByText } = renderProtectedRoute(staffUser);
    
    expect(queryByTestId('admin-content')).toBeNull();
    expect(getByText('Access Denied')).toBeDefined();
  });

  it('allows access to admin users', () => {
    const adminUser = {
      id: '3',
      email: 'admin@vt.edu',
      name: 'Admin User',
      role: 'admin',
    };
    
    const { getByTestId } = renderProtectedRoute(adminUser);
    
    expect(getByTestId('admin-content')).toBeDefined();
  });

  it('shows loading state during authentication check', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: true,
    });

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="admin">
          <MockAdminContent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('admin-content')).toBeNull();
  });

  it('properly validates role requirements', () => {
    const testCases = [
      { role: 'student' as const, shouldHaveAccess: false },
      { role: 'staff' as const, shouldHaveAccess: false },
      { role: 'admin' as const, shouldHaveAccess: true },
    ];

    testCases.forEach(({ role, shouldHaveAccess }) => {
      const user = {
        id: '1',
        email: `${role}@vt.edu`,
        name: `${role} User`,
        role,
      };
      
      (useAuth as any).mockReturnValue({
        user,
        isAuthenticated: true,
        loading: false,
      });

      const { unmount, queryByTestId, getByTestId } = render(
        <MemoryRouter>
          <ProtectedRoute requiredRole="admin">
            <MockAdminContent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      if (shouldHaveAccess) {
        expect(getByTestId('admin-content')).toBeDefined();
      } else {
        expect(queryByTestId('admin-content')).toBeNull();
      }

      unmount();
    });
  });
});