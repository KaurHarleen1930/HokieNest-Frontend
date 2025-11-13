# Listing Types Architecture

## Overview

The system now supports two types of listings:

### 1. Property Listings (`apartment_properties_listings`)
- **Purpose**: Whole apartment buildings or complexes
- **Use Case**: When listing an entire property with multiple units
- **Table**: `apartment_properties_listings`
- **API Endpoint**: `/api/v1/listings`
- **Example**: "The Edge at Blacksburg" - a full apartment complex

### 2. Room/Unit Listings (`room_listings`)
- **Purpose**: Individual rooms or units available for rent
- **Use Case**: 
  - A single room in an existing apartment
  - A private room in a shared house
  - A standalone unit not part of a larger property
- **Table**: `room_listings`
- **API Endpoint**: `/api/v1/room-listings`
- **Example**: "Private room available in 3BR apartment near campus"

## Key Differences

| Feature | Property Listings | Room Listings |
|---------|------------------|---------------|
| **Scope** | Entire property/building | Individual room/unit |
| **Units** | Multiple units per property | Single listing per room |
| **Property Link** | N/A (is the property) | Can link to existing property (optional) |
| **Listing Type** | Whole apartment | Private room, Shared room, or Whole unit |
| **Use Case** | Property managers, large complexes | Individual renters, roommates |

## When to Use Each

### Use Property Listings When:
- Listing an entire apartment building or complex
- Managing multiple units in one location
- Property has multiple available units
- You're a property management company

### Use Room Listings When:
- Listing a single room in an existing apartment
- Looking for a roommate
- Renting out a private room in your apartment
- Listing a standalone unit not part of a larger property

## Database Schema

### Property Listings
- Stores building/complex information
- Links to `apartment_units` table for individual units
- One property can have many units

### Room Listings
- Stores individual room/unit information
- Can optionally link to a property via `property_id`
- Standalone if `property_id` is NULL
- One listing = one available room/unit

## Migration

Run the migration to create the `room_listings` table:

```sql
-- Run this in Supabase SQL Editor
\i server/src/migrations/create_room_listings_table.sql
```

Or copy the contents of `create_room_listings_table.sql` and run it in Supabase Dashboard > SQL Editor.


