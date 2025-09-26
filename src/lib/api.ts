const API_BASE_URL = '/api/v1';

interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  intlFriendly?: boolean;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  address: string;
  beds: number;
  baths: number;
  intlFriendly: boolean;
  imageUrl: string;
  description?: string;
  amenities?: string[];
  contactEmail?: string;
  contactPhone?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  suspended?: boolean;
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(response.status, error.message || 'Request failed');
  }

  return response.json();
}

// Listings API
export const listingsAPI = {
  getAll: (filters?: ListingFilters): Promise<Listing[]> => {
    const searchParams = new URLSearchParams();
    
    if (filters?.minPrice) searchParams.set('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice) searchParams.set('maxPrice', filters.maxPrice.toString());
    if (filters?.beds) searchParams.set('beds', filters.beds.toString());
    if (filters?.baths) searchParams.set('baths', filters.baths.toString());
    if (filters?.intlFriendly !== undefined) searchParams.set('intlFriendly', filters.intlFriendly.toString());

    const query = searchParams.toString();
    return apiRequest<Listing[]>(`/listings${query ? `?${query}` : ''}`);
  },

  getById: (id: string): Promise<Listing> => {
    return apiRequest<Listing>(`/listings/${id}`);
  },
};

// Users API (Admin)
export const usersAPI = {
  getAll: (): Promise<User[]> => {
    return apiRequest<User[]>('/admin/users');
  },

  suspend: (userId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
    });
  },
};