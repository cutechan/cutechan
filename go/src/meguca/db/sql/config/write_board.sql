INSERT INTO boards (id, modOnly, settings)
VALUES ($1, $2, $3)
RETURNING pg_notify('board_updated', $1)
