import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

<<<<<<< HEAD
// Load environment variables
dotenv.config();


const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export interface User {
    user_id: number;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    gender?: string;
    age?: number;
    major?: string;
    created_at: string;
    is_admin: boolean;
    reset_token?: string;
    reset_token_expiry?: string;
}

export interface Listing {
    id: string;
    title: string;
    description?: string;
    price: number;
    address: string;
    beds: number;
    baths: number;
    intl_friendly: boolean;
    image_url: string;
    amenities?: string;
    contact_email?: string;
    contact_phone?: string;
    created_at: string;
    updated_at: string;
}

export interface Favorite {
    id: string;
    user_id: string;
    listing_id: string;
    created_at: string;
}
=======
dotenv.config();
console.log("🔍 [DEBUG] SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("🔍 [DEBUG] SERVICE_ROLE_KEY exists =", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// ✅ Regular client (safe for general database queries)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ✅ Admin client (full privileges, can call auth.admin.*)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('[Supabase] Backend clients initialized successfully');

// 🧱 Types (you can keep these as-is)
export interface User {
  user_id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  gender?: string;
  age?: number;
  major?: string;
  created_at: string;
  is_admin: boolean;
  reset_token?: string;
  reset_token_expiry?: string;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  price: number;
  address: string;
  beds: number;
  baths: number;
  intl_friendly: boolean;
  image_url: string;
  amenities?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}
>>>>>>> 03f9668 (Community Post Backend and frontend ready and dropdown on roommate cards)
