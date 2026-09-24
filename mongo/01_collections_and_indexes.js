const targetDb = db.getSiblingDB("stayspot");

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const SUB_RATING = { bsonType: ["int", "double"], minimum: 1, maximum: 5 };

const validators = {
  PropertyAmenities: {
    $jsonSchema: {
      bsonType: "object",
      required: ["property_id", "amenities", "house_rules", "accessibility_features"],
      properties: {
        property_id: {
          bsonType: "string",
          pattern: UUID_PATTERN,
          description: "Foreign Key linking to PostgreSQL properties(id) - must be a valid UUID string"
        },
        property_title: { bsonType: "string", description: "Optional denormalized title for caching" },
        amenities: {
          bsonType: "array",
          description: "Array of general amenities available at the property",
          items: { bsonType: "string" }
        },
        house_rules: {
          bsonType: "array",
          minItems: 1,
          description: "Nested array of house rules (flexible: string statements or structured rule objects)",
          items: { bsonType: ["string", "object"] }
        },
        accessibility_features: {
          bsonType: "array",
          minItems: 1,
          description: "Nested array of accessibility features (e.g., step-free entrance, wide doorways)",
          items: { bsonType: ["string", "object"] }
        },
        safety_features: {
          bsonType: "array",
          description: "Optional nested array of safety items (e.g., smoke detector, fire extinguisher)",
          items: { bsonType: "string" }
        },
        host_guidelines: {
          bsonType: "object",
          description: "Flexible host notes, keyless entry instructions, or parking details"
        },
        star_rating: { bsonType: "int", minimum: 1, maximum: 5, description: "Hotel class of a real listing" },
        guest_rating: { bsonType: ["int", "double"], minimum: 0, maximum: 10, description: "Guest rating of a real listing, out of 10" },
        updated_at: { bsonType: "date", description: "Timestamp of last catalog update" }
      },
      additionalProperties: true
    }
  },

  PropertyReviews: {
    $jsonSchema: {
      bsonType: "object",
      required: ["property_id", "guest_id", "rating", "location_tags", "review_text", "created_at"],
      properties: {
        property_id: {
          bsonType: "string",
          pattern: UUID_PATTERN,
          description: "Foreign Key linking to PostgreSQL properties(id) - valid UUID string"
        },
        guest_id: {
          bsonType: "string",
          pattern: UUID_PATTERN,
          description: "Foreign Key linking to PostgreSQL guests(id) - valid UUID string"
        },
        booking_id: { bsonType: "string", description: "Optional reference linking to PostgreSQL bookings(id)" },
        rating: {
          bsonType: ["int", "double", "decimal"],
          minimum: 1,
          maximum: 5,
          description: "Overall review rating, bounded strictly between 1 and 5"
        },
        sub_ratings: {
          bsonType: "object",
          description: "Optional granular category ratings",
          properties: {
            cleanliness: SUB_RATING,
            accuracy: SUB_RATING,
            communication: SUB_RATING,
            location: SUB_RATING,
            check_in: SUB_RATING,
            value: SUB_RATING
          }
        },
        location_tags: {
          bsonType: "array",
          minItems: 1,
          description: "Array of descriptive tags for review analytics (e.g., 'it_corridor', 'walkable')",
          items: { bsonType: "string" }
        },
        review_text: { bsonType: "string", minLength: 3, description: "Review commentary provided by guest" },
        created_at: { bsonType: "date", description: "Timestamp when review was submitted" }
      }
    }
  },

  SearchSessions: {
    $jsonSchema: {
      bsonType: "object",
      required: ["session_id", "user_id", "location", "created_at"],
      properties: {
        session_id: { bsonType: "string", description: "Unique tracking session identifier" },
        user_id: { bsonType: "string", description: "Identifier of guest or anonymous searcher" },
        location: {
          bsonType: "object",
          required: ["type", "coordinates"],
          description: "GeoJSON Point representing pin drop location",
          properties: {
            type: { enum: ["Point"], description: "GeoJSON geometry type, must be 'Point'" },
            coordinates: {
              bsonType: "array",
              minItems: 2,
              maxItems: 2,
              description: "Coordinates in GeoJSON format: [longitude, latitude]",
              items: { bsonType: ["double", "int", "long", "decimal"] }
            }
          }
        },
        search_radius_meters: {
          bsonType: ["int", "double"],
          minimum: 100,
          maximum: 100000,
          description: "Search radius requested by user in meters"
        },
        filters: { bsonType: "object", description: "Search criteria applied during pin drop (price, amenities, etc.)" },
        device_info: { bsonType: "object", description: "Client metadata (platform, app_version)" },
        created_at: { bsonType: "date", description: "Timestamp of pin drop. Governed by 2-hour TTL expiration index" }
      }
    }
  }
};

const indexes = {
  SearchSessions: [
    [{ location: "2dsphere", created_at: 1 }, { name: "idx_searchsessions_location_created_2dsphere" }],
    [{ created_at: 1 }, { name: "idx_searchsessions_created_at_ttl_2h", expireAfterSeconds: 7200 }],
    [{ user_id: 1, created_at: -1 }, { name: "idx_searchsessions_user_time" }]
  ],
  PropertyReviews: [
    [{ property_id: 1, created_at: -1 }, { name: "idx_reviews_property_created" }],
    [{ rating: 1 }, { name: "idx_reviews_rating" }],
    [{ location_tags: 1 }, { name: "idx_reviews_location_tags" }],
    [{ guest_id: 1 }, { name: "idx_reviews_guest_id" }]
  ],
  PropertyAmenities: [
    [{ property_id: 1 }, { name: "idx_amenities_property_id_unique", unique: true }],
    [{ amenities: 1 }, { name: "idx_amenities_catalog" }]
  ]
};

print("Initializing StaySpot MongoDB collections and indexes on " + targetDb.getName());

const existing = targetDb.getCollectionNames();
for (const [name, validator] of Object.entries(validators)) {
  if (existing.includes(name)) {
    targetDb.runCommand({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    print(`  [UPDATE] ${name} validator`);
  } else {
    targetDb.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    print(`  [CREATE] ${name} with validator`);
  }
}

if (targetDb.SearchSessions.getIndexes().some((i) => i.name === "idx_searchsessions_location_2dsphere")) {
  targetDb.SearchSessions.dropIndex("idx_searchsessions_location_2dsphere");
}

for (const [name, specs] of Object.entries(indexes)) {
  for (const [key, options] of specs) {
    targetDb[name].createIndex(key, options);
  }
  targetDb[name].getIndexes().forEach((idx) => {
    const ttl = idx.expireAfterSeconds ? ` (TTL ${idx.expireAfterSeconds / 3600}h)` : "";
    const unique = idx.unique ? " (UNIQUE)" : "";
    print(`  ${name}.${idx.name}: ${JSON.stringify(idx.key)}${ttl}${unique}`);
  });
}

print("[SUCCESS] Collections and indexes provisioned");
