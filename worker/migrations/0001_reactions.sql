-- Reactions: one row per (poster, emoji, user). Only the Firebase uid is stored about the user.
CREATE TABLE reactions (
  poster_id  TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  uid        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (poster_id, emoji, uid)
) WITHOUT ROWID;

-- For "my reactions" lookups and deleting a user's data.
CREATE INDEX reactions_by_uid ON reactions (uid, poster_id);

-- Running totals, so reading counts never scans reactions.
CREATE TABLE counts (
  poster_id TEXT NOT NULL,
  emoji     TEXT NOT NULL,
  count     INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (poster_id, emoji)
) WITHOUT ROWID;

-- Kept in step by triggers, so every insert or delete path (API, user deletion) stays correct.
CREATE TRIGGER reactions_after_insert AFTER INSERT ON reactions
BEGIN
  INSERT INTO counts (poster_id, emoji, count) VALUES (NEW.poster_id, NEW.emoji, 1)
  ON CONFLICT (poster_id, emoji) DO UPDATE SET count = count + 1;
END;

CREATE TRIGGER reactions_after_delete AFTER DELETE ON reactions
BEGIN
  UPDATE counts SET count = count - 1 WHERE poster_id = OLD.poster_id AND emoji = OLD.emoji;
  DELETE FROM counts WHERE poster_id = OLD.poster_id AND emoji = OLD.emoji AND count = 0;
END;
