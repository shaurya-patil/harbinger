-- Initial data for Harbinger Agent Memory System
-- Sample aliases for user 'shaurya'

-- ============================================
-- Email Aliases
-- ============================================
INSERT INTO user_aliases (user_id, alias_type, alias_value, description) VALUES
('shaurya', 'email', 'shauryap71412@gmail.com', 'personal email'),
('shaurya', 'email', 'shaurya.patil226@nmims.edu.in', 'educational email (NMIMS)');

-- ============================================
-- Name Aliases
-- ============================================
INSERT INTO user_aliases (user_id, alias_type, alias_value, description) VALUES
('shaurya', 'name', 'Shaurya', 'first name'),
('shaurya', 'name', 'Shaurya Patil', 'full name'),
('shaurya', 'nickname', 'SP', 'initials');

-- ============================================
-- Sample Preferences (optional - customize as needed)
-- ============================================
INSERT INTO user_aliases (user_id, alias_type, alias_value, description) VALUES
('shaurya', 'preference', 'favorite_ide', 'VS Code'),
('shaurya', 'preference', 'preferred_language', 'JavaScript'),
('shaurya', 'preference', 'default_browser', 'Chrome');

-- ============================================
-- Sample Locations (optional - customize as needed)
-- ============================================
-- Uncomment and customize these if you want to add location aliases
-- INSERT INTO user_aliases (user_id, alias_type, alias_value, description, metadata) VALUES
-- ('shaurya', 'location', 'home', 'Your home address', '{"coordinates": {"lat": 19.0760, "lng": 72.8777}}'),
-- ('shaurya', 'location', 'college', 'NMIMS Campus, Mumbai', NULL);

COMMIT;
