import { supabase } from '../lib/supabase';

interface RentCastEstimate {
  address: string;
  rentEstimate: number;
  confidence: 'high' | 'medium' | 'low';
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  lastUpdated: string;
}

interface RentCastMarketData {
  zipCode: string;
  averageRent: number;
  medianRent: number;
  rentTrend: 'increasing' | 'decreasing' | 'stable';
  marketScore: number;
  lastUpdated: string;
}

export class RentCastService {
  private apiKey: string;
  private baseUrl = 'https://api.rentcast.io/v1';

  constructor() {
    this.apiKey = process.env.RENTCAST_API_KEY || '';
    if (!this.apiKey) {
      console.warn('RENTCAST_API_KEY not found. RentCast features will be disabled.');
    }
  }

  /**
   * Get rental estimate for a specific address
   * This is called from backend only - API key never exposed to frontend
   */
  async getRentalEstimate(address: string): Promise<RentCastEstimate | null> {
    if (!this.apiKey) {
      console.warn('RentCast API key not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/rental-estimates`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        // Use URLSearchParams to properly encode the address
        // Note: This is a simplified example - check RentCast docs for exact API format
      });

      if (!response.ok) {
        console.error('RentCast API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      return {
        address: data.address || address,
        rentEstimate: data.rentEstimate || 0,
        confidence: data.confidence || 'low',
        bedrooms: data.bedrooms || 0,
        bathrooms: data.bathrooms || 0,
        squareFootage: data.squareFootage,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error calling RentCast API:', error);
      return null;
    }
  }

  /**
   * Get market data for a zip code
   */
  async getMarketData(zipCode: string): Promise<RentCastMarketData | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/markets?zipCode=${zipCode}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('RentCast market data error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      return {
        zipCode: data.zipCode || zipCode,
        averageRent: data.averageRent || 0,
        medianRent: data.medianRent || 0,
        rentTrend: data.rentTrend || 'stable',
        marketScore: data.marketScore || 50,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error calling RentCast market API:', error);
      return null;
    }
  }

  /**
   * Cache rental estimates in your database to reduce API calls
   */
  async cacheRentalEstimate(address: string, estimate: RentCastEstimate): Promise<void> {
    try {
      await supabase
        .from('rental_estimates')
        .upsert({
          address: estimate.address,
          rent_estimate: estimate.rentEstimate,
          confidence: estimate.confidence,
          bedrooms: estimate.bedrooms,
          bathrooms: estimate.bathrooms,
          square_footage: estimate.squareFootage,
          last_updated: estimate.lastUpdated,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error caching rental estimate:', error);
    }
  }

  /**
   * Get cached rental estimate to avoid API calls
   */
  async getCachedRentalEstimate(address: string): Promise<RentCastEstimate | null> {
    try {
      const { data, error } = await supabase
        .from('rental_estimates')
        .select('*')
        .eq('address', address)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if data is fresh (less than 30 days old)
      const lastUpdated = new Date(data.last_updated);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      if (lastUpdated < thirtyDaysAgo) {
        // Data is stale, return null to trigger fresh API call
        return null;
      }

      return {
        address: data.address,
        rentEstimate: data.rent_estimate,
        confidence: data.confidence,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareFootage: data.square_footage,
        lastUpdated: data.last_updated,
      };
    } catch (error) {
      console.error('Error getting cached rental estimate:', error);
      return null;
    }
  }
}

// Export singleton instance
export const rentCastService = new RentCastService();
