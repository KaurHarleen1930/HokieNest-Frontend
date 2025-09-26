import request from 'supertest';
import app from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Listings Routes', () => {
  beforeAll(async () => {
    // Clean up and seed test data
    await prisma.listing.deleteMany();

    await prisma.listing.createMany({
      data: [
        {
          title: 'Test Listing 1',
          price: 1000,
          address: 'Test Address 1',
          beds: 2,
          baths: 1,
          intlFriendly: true,
          imageUrl: 'https://example.com/image1.jpg',
          amenities: JSON.stringify(['wifi', 'parking']),
        },
        {
          title: 'Test Listing 2',
          price: 1500,
          address: 'Test Address 2',
          beds: 3,
          baths: 2,
          intlFriendly: false,
          imageUrl: 'https://example.com/image2.jpg',
          amenities: JSON.stringify(['wifi']),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/v1/listings', () => {
    it('should return all listings without filters', async () => {
      const response = await request(app)
        .get('/api/v1/listings');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).toHaveProperty('amenities');
      expect(Array.isArray(response.body[0].amenities)).toBe(true);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/v1/listings?minPrice=1200');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].price).toBe(1500);
    });

    it('should filter by beds', async () => {
      const response = await request(app)
        .get('/api/v1/listings?beds=2');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].beds).toBe(2);
    });

    it('should filter by international friendly', async () => {
      const response = await request(app)
        .get('/api/v1/listings?intlFriendly=true');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].intlFriendly).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/v1/listings?beds=2&intlFriendly=true');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].beds).toBe(2);
      expect(response.body[0].intlFriendly).toBe(true);
    });
  });

  describe('GET /api/v1/listings/:id', () => {
    let listingId: string;

    beforeAll(async () => {
      const listing = await prisma.listing.findFirst();
      listingId = listing!.id;
    });

    it('should return specific listing by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/listings/${listingId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(listingId);
      expect(response.body).toHaveProperty('amenities');
      expect(Array.isArray(response.body.amenities)).toBe(true);
    });

    it('should return 404 for non-existent listing', async () => {
      const response = await request(app)
        .get('/api/v1/listings/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Listing not found');
    });
  });
});