INSERT INTO boards (id, modOnly, settings)
VALUES ($1, FALSE, $2)
RETURNING pg_notify('board_updated', $1)
