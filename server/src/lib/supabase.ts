import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
