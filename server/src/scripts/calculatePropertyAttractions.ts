/**
 * Script to calculate and update nearest 5 attractions for each property
 * 
 * This script:
 * 1. Fetches all active properties with latitude/longitude
 * 2. Fetches all active attractions with latitude/longitude
 * 3. For each property, calculates distance to all attractions
 * 4. Finds the nearest 5 attractions
 * 5. Updates/inserts records in property_attractions table
 * 
 * Usage: 
 *   npx ts-node server/src/scripts/calculatePropertyAttractions.ts
 *   OR
 *   cd server && npm run calculate-attractions
 */

import "dotenv/config";
import { supabase } from '../lib/supabase';
import { calculateDistance, estimateWalkingTime, estimateDrivingTime } from '../utils/distance';

interface Property {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface Attraction {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface PropertyAttraction {
  property_id: string;
  attraction_id: string;
  distance_miles: number;
  walking_time_minutes: number;
  driving_time_minutes: number;
}

async function calculateNearestAttractions() {
  console.log('🚀 Starting calculation of nearest attractions for all properties...\n');

  try {
    // Step 1: Fetch all active properties with coordinates
    console.log('📋 Step 1: Fetching active properties...');
    const { data: properties, error: propertiesError } = await supabase
      .from('apartment_properties_listings')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (propertiesError) {
      throw new Error(`Error fetching properties: ${propertiesError.message}`);
    }

    if (!properties || properties.length === 0) {
      console.log('⚠️  No active properties found with coordinates.');
      return;
    }

    console.log(`✅ Found ${properties.length} active properties with coordinates.\n`);

    // Step 2: Fetch all active attractions with coordinates
    console.log('📍 Step 2: Fetching active attractions...');
    const { data: attractions, error: attractionsError } = await supabase
      .from('attractions')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (attractionsError) {
      throw new Error(`Error fetching attractions: ${attractionsError.message}`);
    }

    if (!attractions || attractions.length === 0) {
      console.log('⚠️  No active attractions found with coordinates.');
      return;
    }

    console.log(`✅ Found ${attractions.length} active attractions with coordinates.\n`);

    // Step 3: Calculate distances for each property
    console.log('🧮 Step 3: Calculating distances...');
    const allPropertyAttractions: PropertyAttraction[] = [];
    let processedCount = 0;

    for (const property of properties) {
      const propertyLat = parseFloat(property.latitude as any);
      const propertyLng = parseFloat(property.longitude as any);

      if (isNaN(propertyLat) || isNaN(propertyLng)) {
        console.log(`⚠️  Skipping property ${property.name} (${property.id}): Invalid coordinates`);
        continue;
      }

      // Calculate distance to all attractions
      const distances = attractions
        .map(attraction => {
          const attrLat = parseFloat(attraction.latitude as any);
          const attrLng = parseFloat(attraction.longitude as any);

          if (isNaN(attrLat) || isNaN(attrLng)) {
            return null;
          }

          const distance = calculateDistance(propertyLat, propertyLng, attrLat, attrLng);
          const walkingTime = estimateWalkingTime(distance);
          const drivingTime = estimateDrivingTime(distance);

          return {
            property_id: property.id,
            attraction_id: attraction.id,
            distance_miles: distance,
            walking_time_minutes: walkingTime,
            driving_time_minutes: drivingTime
          };
        })
        .filter((d): d is PropertyAttraction => d !== null)
        .sort((a, b) => a.distance_miles - b.distance_miles)
        .slice(0, 5); // Get top 5 nearest

      allPropertyAttractions.push(...distances);
      processedCount++;

      if (processedCount % 100 === 0) {
        console.log(`   Processed ${processedCount}/${properties.length} properties...`);
      }
    }

    console.log(`✅ Calculated distances for ${processedCount} properties.\n`);
    console.log(`📊 Total property-attraction pairs: ${allPropertyAttractions.length}\n`);

    // Step 4: Clear existing records (optional - comment out if you want to keep existing data)
    console.log('🗑️  Step 4: Clearing existing property_attractions records...');
    const { error: deleteError } = await supabase
      .from('property_attractions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.log(`⚠️  Warning: Could not clear existing records: ${deleteError.message}`);
      console.log('   Continuing with insert/update...\n');
    } else {
      console.log('✅ Cleared existing records.\n');
    }

    // Step 5: Insert new records in batches
    console.log('💾 Step 5: Inserting new records...');
    const batchSize = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allPropertyAttractions.length; i += batchSize) {
      const batch = allPropertyAttractions.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('property_attractions')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
        console.log(`   Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allPropertyAttractions.length / batchSize)} (${insertedCount} records)...`);
      }
    }

    console.log(`\n✅ Successfully inserted ${insertedCount} records.`);
    if (errorCount > 0) {
      console.log(`⚠️  Failed to insert ${errorCount} records.`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Properties processed: ${processedCount}`);
    console.log(`   Attractions available: ${attractions.length}`);
    console.log(`   Property-attraction pairs created: ${allPropertyAttractions.length}`);
    console.log(`   Average attractions per property: ${(allPropertyAttractions.length / processedCount).toFixed(2)}`);
    console.log('\n✨ Calculation complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  calculateNearestAttractions()
    .then(() => {
      console.log('\n✅ Script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { calculateNearestAttractions };

