-- Allow image-only newsfeed posts (no title/body text) — the admin can
-- now publish a photo alone, which fills the whole card on the public
-- pages instead of showing an empty text area.

ALTER TABLE newsfeed_posts ALTER COLUMN title DROP NOT NULL;
ALTER TABLE newsfeed_posts ALTER COLUMN body DROP NOT NULL;

-- A post must still have *something* to show — either title/body text or
-- an image. Enforced at the DB level so this invariant can't be violated
-- by any future code path, not just the current admin route.
ALTER TABLE newsfeed_posts ADD CONSTRAINT newsfeed_posts_has_content
  CHECK (title IS NOT NULL OR body IS NOT NULL OR image_url IS NOT NULL);
