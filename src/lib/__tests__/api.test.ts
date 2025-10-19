import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { preferencesAPI, listingsAPI, mapAPI, usersAPI } from '../api';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('fake-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preferencesAPI', () => {
    it('should save housing priorities successfully', async () => {
      const mockResponse = { success: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const priorities = {
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10,
      };

      const result = await preferencesAPI.saveHousingPriorities(priorities);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/preferences/housing-priorities',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer fake-token',
          }),
          body: JSON.stringify(priorities),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should get housing priorities successfully', async () => {
      const mockResponse = {
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await preferencesAPI.getHousingPriorities();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/preferences/housing-priorities',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should delete housing priorities successfully', async () => {
      const mockResponse = { success: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await preferencesAPI.deleteHousingPriorities();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/preferences/housing-priorities',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors when saving priorities', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      const priorities = {
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10,
      };

      await expect(preferencesAPI.saveHousingPriorities(priorities)).rejects.toThrow();
    });

    it('should work without authentication token', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const mockResponse = {
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await preferencesAPI.getHousingPriorities();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/preferences/housing-priorities',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.anything(),
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('listingsAPI', () => {
    it('should get all listings successfully', async () => {
      const mockListings = [
        {
          id: '1',
          title: 'Test Property',
          price: 1000,
          address: '123 Test St',
          beds: 2,
          baths: 1,
          intlFriendly: true,
          imageUrl: 'test.jpg',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockListings,
      });

      const result = await listingsAPI.getAll();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/listings',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
          }),
        })
      );

      expect(result).toEqual(mockListings);
    });

    it('should get listings with filters', async () => {
      const filters = {
        minPrice: 800,
        maxPrice: 1200,
        beds: 2,
        intlFriendly: true,
      };

      const mockListings = [];
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockListings,
      });

      await listingsAPI.getAll(filters);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/listings?minPrice=800&maxPrice=1200&beds=2&intlFriendly=true',
        expect.any(Object)
      );
    });

    it('should get listing by ID successfully', async () => {
      const mockListing = {
        id: '1',
        title: 'Test Property',
        price: 1000,
        address: '123 Test St',
        beds: 2,
        baths: 1,
        intlFriendly: true,
        imageUrl: 'test.jpg',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockListing,
      });

      const result = await listingsAPI.getById('1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/listings/1',
        expect.any(Object)
      );

      expect(result).toEqual(mockListing);
    });
  });

  describe('mapAPI', () => {
    it('should get map markers successfully', async () => {
      const mockMarkers = [
        {
          id: '1',
          name: 'Test Property',
          address: '123 Test St',
          latitude: 40.7128,
          longitude: -74.0060,
          rent_min: 1000,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarkers,
      });

      const result = await mapAPI.getMapMarkers();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/map/markers',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
          }),
        })
      );

      expect(result).toEqual(mockMarkers);
    });

    it('should get nearby properties successfully', async () => {
      const mockProperties = [
        {
          id: '1',
          name: 'Nearby Property',
          latitude: 40.7128,
          longitude: -74.0060,
          rent_min: 1000,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProperties,
      });

      const result = await mapAPI.getNearbyProperties(40.7128, -74.0060, 5, 10);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/map/nearby-properties?latitude=40.7128&longitude=-74.0060&radius_miles=5&limit=10',
        expect.any(Object)
      );

      expect(result).toEqual(mockProperties);
    });
  });

  describe('usersAPI', () => {
    it('should get all users successfully', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'test@vt.edu',
          name: 'Test User',
          role: 'student' as const,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      });

      const result = await usersAPI.getAll();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/admin/users',
        expect.any(Object)
      );

      expect(result).toEqual(mockUsers);
    });

    it('should suspend user successfully', async () => {
      const mockResponse = { success: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await usersAPI.suspend('user1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/admin/users/user1/suspend',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(preferencesAPI.getHousingPriorities()).rejects.toThrow('Network error');
    });

    it('should handle non-JSON error responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON'); },
      });

      await expect(preferencesAPI.getHousingPriorities()).rejects.toThrow();
    });
  });
});

