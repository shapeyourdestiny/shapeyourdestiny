-- =============================================================================
-- INSERT CHRISTMAS 2026 PARTY EVENT
-- =============================================================================
-- Run this after the team-event-public-rsvp.sql migration
-- =============================================================================

INSERT INTO team_events (
  type,
  title,
  event_date,
  start_time,
  end_time,
  location,
  location_url,
  details,
  paid,
  required,
  audience,
  public_rsvp,
  public_slug,
  allow_guests,
  note,
  highlight
) VALUES (
  'social',
  '🎄 Shape Your Destiny Christmas Celebration! 🎄',
  '2026-12-05',
  '12:30:00',
  '15:00:00',
  'The Wolf''s Den – American Ninja Warrior Gym',
  'https://maps.apple.com/p/bCPA3ATp5W26YK',
  'Holiday celebration with the SYD team at Wolf''s Den!',
  false,
  false,
  '{"type":"all"}',
  true,
  'christmas-2026',
  true,
  E'Hi Team! ❤️\n\nAs we wrap up another incredible year, I want to take a moment to let each of you know how much I appreciate you and all the hard work, dedication, and heart you''ve put into our programs throughout the year.\n\nTo show my appreciation, I''d love to bring everyone together for a little holiday fun before we head into our winter break!\n\nWe''re going to have some fun tackling obstacles together, laughing, spending time with one another, and enjoying each other''s company outside of work! You''re more than welcome to bring your significant other and your kids. The more, the merrier!\n\nI know how much effort goes into what we do, and I never want that to go unnoticed. Each of you plays an important role in making Shape Your Destiny what it is, and I''m truly grateful to have you on this team.\n\nSince we''ll be on break until January, I thought this would be the perfect opportunity to celebrate everything we''ve accomplished, make some memories, and simply enjoy ourselves before the new year.\n\nI really hope everyone can make it!',
  '🎁 Everyone received a Christmas bonus on their last paycheck as an extra thank-you!'
);
