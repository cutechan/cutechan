UPDATE boards
SET modOnly = $2, settings = $3
WHERE id = $1
RETURNING
  pg_notify('board_updated', $1),
  log_moderation(6::smallint, $1, 0::bigint, $4)
