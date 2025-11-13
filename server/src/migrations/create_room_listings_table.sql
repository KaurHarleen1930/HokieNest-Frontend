-- Migration: Create separate table for room/unit listings
-- This allows individual rooms or units to be listed separately from whole properties

-- Create room_listings table for individual room/unit listings
CREATE TABLE IF NOT EXISTS room_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES apartment_properties_listings(id) ON DELETE SET NULL,
  -- If property_id is null, this is a standalone room listing (e.g., private room in existing apartment)
  listing_type VARCHAR(50) NOT NULL CHECK (listing_type IN ('private_room', 'shared_room', 'whole_unit')),
  
  -- Room/Unit Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Room Specifications
  beds INTEGER NOT NULL DEFAULT 1,
  baths DECIMAL(3, 1) NOT NULL DEFAULT 1.0,
  square_feet INTEGER,
  rent_amount DECIMAL(10, 2) NOT NULL,
  security_deposit DECIMAL(10, 2),
  application_fee DECIMAL(10, 2),
  
  -- Availability
  availability_status VARCHAR(50) DEFAULT 'available',
  move_in_date DATE,
  lease_term_months INTEGER,
  
  -- Features
  furnished BOOLEAN DEFAULT false,
  pet_friendly BOOLEAN DEFAULT false,
  utilities_included BOOLEAN DEFAULT false,
  parking_available BOOLEAN DEFAULT false,
  intl_friendly BOOLEAN DEFAULT false,
  
  -- Media
  photos JSONB,
  thumbnail_url TEXT,
  
  -- Additional Info
  amenities JSONB,
  house_rules TEXT,
  preferred_gender VARCHAR(20), -- 'male', 'female', 'any'
  preferred_age_range VARCHAR(20), -- e.g., '18-25', '25-35'
  
  -- Contact (will use messaging system, but store for reference)
  website_url TEXT,
  
  -- Metadata
  created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_rent CHECK (rent_amount >= 0),
  CONSTRAINT valid_beds CHECK (beds >= 0),
  CONSTRAINT valid_baths CHECK (baths >= 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_room_listings_property_id ON room_listings(property_id);
CREATE INDEX IF NOT EXISTS idx_room_listings_listing_type ON room_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_room_listings_city_state ON room_listings(city, state);
CREATE INDEX IF NOT EXISTS idx_room_listings_created_by ON room_listings(created_by);
CREATE INDEX IF NOT EXISTS idx_room_listings_active ON room_listings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_room_listings_location ON room_listings(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create unique constraint for standalone listings (name + address)
-- Only apply if property_id is NULL (standalone listings)
CREATE UNIQUE INDEX IF NOT EXISTS ux_room_listings_title_address 
ON room_listings(title, address) 
WHERE property_id IS NULL AND is_active = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_room_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_room_listings_updated_at 
    BEFORE UPDATE ON room_listings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_room_listings_updated_at();

-- Add comment
COMMENT ON TABLE room_listings IS 'Individual room or unit listings that can be associated with a property or standalone';
COMMENT ON COLUMN room_listings.property_id IS 'If set, this room is part of an existing property listing. If NULL, this is a standalone room listing.';


