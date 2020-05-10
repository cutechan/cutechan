DELETE FROM bans WHERE board = $1 AND forPost = $2
RETURNING
  pg_notify('bans_updated', ''),
  log_moderation(1::smallint, $1, $2, $3)
