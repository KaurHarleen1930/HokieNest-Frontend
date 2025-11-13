-- Migration: Remove unique constraint on name + address
-- This allows multiple listings with the same name and address
-- (e.g., different users posting the same property, or same user updating)

-- Drop the unique constraint/index - try both possible names
DROP INDEX IF EXISTS ux_apartment_properties_listings_name_address;
DROP INDEX IF EXISTS ux_props_name_address;

-- If it's a UNIQUE CONSTRAINT (not just an index), use:
ALTER TABLE apartment_properties_listings 
DROP CONSTRAINT IF EXISTS ux_apartment_properties_listings_name_address;

ALTER TABLE apartment_properties_listings 
DROP CONSTRAINT IF EXISTS ux_props_name_address;

-- Note: After running this, multiple listings with the same name+address will be allowed

