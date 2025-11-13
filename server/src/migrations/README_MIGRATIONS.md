# Database Migrations

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of the migration file
4. Click **Run** to execute

### Option 2: Using Supabase CLI
```bash
supabase db push
```

## Required Migrations

### 1. Add Listing Columns
**File:** `add_listing_columns.sql`
- Adds `created_by` column to `apartment_properties_listings` table
- This links listings to the user who created them

### 2. Create Storage Bucket
**File:** `create_listing_photos_bucket.sql` (instructions only)
- Storage buckets must be created via Dashboard or API
- See instructions in the file

## Quick Setup

1. **Run the migration:**
   - Open Supabase Dashboard > SQL Editor
   - Copy contents of `add_listing_columns.sql`
   - Execute

2. **Create storage bucket:**
   - Go to Supabase Dashboard > Storage
   - Click "New bucket"
   - Name: `listing-photos`
   - Public: **Yes** (checked)
   - Create


