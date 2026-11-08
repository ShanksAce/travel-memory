ALTER TABLE itinerary ADD COLUMN lat REAL;
ALTER TABLE itinerary ADD COLUMN lng REAL;
ALTER TABLE itinerary ADD COLUMN transport_mode TEXT NOT NULL DEFAULT '';
ALTER TABLE itinerary ADD COLUMN transport_minutes INTEGER;
