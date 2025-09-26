import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.favorite.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const hashedPassword = await bcrypt.hash('password', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'jdoe@vt.edu',
        name: 'John Doe',
        password: hashedPassword,
        role: 'student',
      },
    }),
    prisma.user.create({
      data: {
        email: 'staff@vt.edu',
        name: 'Staff Member',
        password: hashedPassword,
        role: 'staff',
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@vt.edu',
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} demo users`);

  // Create demo listings
  const listings = [
    {
      title: 'Modern 2BR Apartment Near VT Campus',
      description: 'Beautiful modern apartment with updated kitchen and spacious living areas. Perfect for students and close to campus with easy bus access.',
      price: 1200,
      address: '123 College Ave, Blacksburg, VA 24060',
      beds: 2,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'parking', 'utilities']),
      contactEmail: 'landlord1@example.com',
      contactPhone: '(540) 555-0101',
    },
    {
      title: 'Cozy Studio in Historic Downtown',
      description: 'Charming studio apartment in the heart of downtown Blacksburg. Walking distance to campus and local attractions.',
      price: 800,
      address: '456 Main St, Blacksburg, VA 24060',
      beds: 1,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'security']),
      contactEmail: 'landlord2@example.com',
    },
    {
      title: 'Spacious 3BR House with Yard',
      description: 'Large house perfect for group living. Features a big backyard, modern kitchen, and plenty of parking.',
      price: 1800,
      address: '789 University Dr, Blacksburg, VA 24060',
      beds: 3,
      baths: 2,
      intlFriendly: false,
      imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['parking', 'utilities']),
      contactEmail: 'landlord3@example.com',
      contactPhone: '(540) 555-0103',
    },
    {
      title: 'International Student Friendly 1BR',
      description: 'Perfect for international students with furnished options and flexible lease terms. Close to international student services.',
      price: 900,
      address: '321 Global Way, Blacksburg, VA 24060',
      beds: 1,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'security', 'utilities']),
      contactEmail: 'intl.housing@example.com',
    },
    {
      title: 'Luxury 2BR with Pool Access',
      description: 'Upscale apartment complex with pool, gym, and study rooms. Premium location with shuttle service to campus.',
      price: 1500,
      address: '555 Luxury Ln, Blacksburg, VA 24060',
      beds: 2,
      baths: 2,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'parking', 'security']),
      contactEmail: 'luxury@example.com',
      contactPhone: '(540) 555-0105',
    },
    {
      title: 'Budget-Friendly Shared Housing',
      description: 'Affordable shared housing option with individual bedrooms and common areas. Great for students on a budget.',
      price: 600,
      address: '777 Budget St, Blacksburg, VA 24060',
      beds: 1,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi']),
      contactEmail: 'budget@example.com',
    },
    {
      title: 'Graduate Student Preferred 1BR',
      description: 'Quiet apartment perfect for graduate students. Features a home office space and is located in a peaceful neighborhood.',
      price: 1000,
      address: '888 Graduate Ave, Blacksburg, VA 24060',
      beds: 1,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'parking']),
      contactEmail: 'grad.housing@example.com',
    },
    {
      title: 'Family-Style 4BR Townhouse',
      description: 'Perfect for larger groups or families. Spacious townhouse with multiple levels and private entrance.',
      price: 2200,
      address: '999 Family Cir, Blacksburg, VA 24060',
      beds: 4,
      baths: 3,
      intlFriendly: false,
      imageUrl: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['parking', 'utilities']),
      contactEmail: 'family@example.com',
      contactPhone: '(540) 555-0108',
    },
    {
      title: 'Off-Campus 2BR with Study Room',
      description: 'Ideal for serious students with dedicated study spaces. Quiet location with reliable internet and modern amenities.',
      price: 1100,
      address: '111 Study Hall Dr, Blacksburg, VA 24060',
      beds: 2,
      baths: 1,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'security']),
      contactEmail: 'study@example.com',
    },
    {
      title: 'Mountain View 3BR Apartment',
      description: 'Stunning views of the Blue Ridge Mountains. Spacious apartment with modern appliances and outdoor balcony.',
      price: 1600,
      address: '222 Mountain View Rd, Blacksburg, VA 24060',
      beds: 3,
      baths: 2,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'parking', 'utilities']),
      contactEmail: 'mountain@example.com',
      contactPhone: '(540) 555-0110',
    },
    {
      title: 'Downtown Loft with Character',
      description: 'Unique loft space in converted historic building. High ceilings, exposed brick, and walking distance to everything.',
      price: 1300,
      address: '333 Historic St, Blacksburg, VA 24060',
      beds: 2,
      baths: 1,
      intlFriendly: false,
      imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'security']),
      contactEmail: 'loft@example.com',
    },
    {
      title: 'Pet-Friendly 2BR Garden Apartment',
      description: 'Ground floor apartment with garden access. Pet-friendly community with dog park and walking trails nearby.',
      price: 1250,
      address: '444 Garden Grove, Blacksburg, VA 24060',
      beds: 2,
      baths: 2,
      intlFriendly: true,
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      amenities: JSON.stringify(['wifi', 'parking']),
      contactEmail: 'pets@example.com',
      contactPhone: '(540) 555-0112',
    },
  ];

  const createdListings = await Promise.all(
    listings.map(listing => prisma.listing.create({ data: listing }))
  );

  console.log(`✅ Created ${createdListings.length} demo listings`);
  console.log('🌱 Database seed completed successfully!');
  console.log('\n📋 Demo Accounts:');
  console.log('Student: jdoe@vt.edu / password');
  console.log('Staff: staff@vt.edu / password');
  console.log('Admin: admin@vt.edu / password');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });