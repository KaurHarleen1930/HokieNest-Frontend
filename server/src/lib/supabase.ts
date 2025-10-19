import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET');
console.log('Supabase Key:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 10)}...` : 'NOT SET');

// Create a mock supabase client for development when not configured
const createMockSupabase = () => {
    // Store mock data in memory for development
    const mockData: any = {};
    
    return {
        from: (table: string) => ({
            select: (columns?: string) => ({
                eq: (column: string, value: any) => ({
                    single: () => {
                        const key = `${table}_${column}_${value}`;
                        return Promise.resolve({ 
                            data: mockData[key] || null, 
                            error: mockData[key] ? null : { code: 'PGRST116' } 
                        });
                    },
                    maybeSingle: () => {
                        const key = `${table}_${column}_${value}`;
                        return Promise.resolve({ 
                            data: mockData[key] || null, 
                            error: mockData[key] ? null : { code: 'PGRST116' } 
                        });
                    }
                }),
                maybeSingle: () => {
                    // For general queries, return no data
                    return Promise.resolve({ 
                        data: null, 
                        error: { code: 'PGRST116' } 
                    });
                }
            }),
            insert: (data: any) => {
                // Mock successful insert
                return Promise.resolve({ data: null, error: null });
            },
            update: (data: any) => ({
                eq: (column: string, value: any) => {
                    // Mock successful update
                    return Promise.resolve({ data: null, error: null });
                }
            }),
            delete: () => ({
                eq: (column: string, value: any) => {
                    // Mock successful delete
                    return Promise.resolve({ error: null });
                }
            })
        })
    };
};

let supabaseClient: any;

// Check if we have valid Supabase configuration
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && 
    !supabaseUrl.includes('your_supabase') && !supabaseServiceKey.includes('your_') &&
    supabaseUrl.startsWith('https://');

if (!isSupabaseConfigured) {
    console.error('❌ Supabase not properly configured. Using mock client for development.');
    console.log('   Expected: SUPABASE_URL=https://your-project.supabase.co');
    console.log('   Expected: SUPABASE_SERVICE_ROLE_KEY=your-service-key');
    supabaseClient = createMockSupabase();
} else {
    try {
        // Validate URL format
        new URL(supabaseUrl);
        
        // Create Supabase client with service role key for server-side operations
        supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('✅ Supabase client initialized successfully');
        console.log('   URL:', supabaseUrl.substring(0, 30) + '...');
    } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
        console.log('🔄 Falling back to mock client');
        supabaseClient = createMockSupabase();
    }
}

export const supabase = supabaseClient;

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

export interface HousingPriorities {
    priority_id?: number;
    user_id: number;
    budget_priority: number;
    commute_priority: number;
    safety_priority: number;
    roommates_priority: number;
    created_at?: string;
    updated_at?: string;
}
