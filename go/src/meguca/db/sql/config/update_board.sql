UPDATE boards
SET modOnly = $2, settings = $3
WHERE id = $1
RETURNING pg_notify('board_updated', $1)
