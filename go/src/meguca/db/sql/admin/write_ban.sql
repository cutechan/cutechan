INSERT INTO bans (board, ip, forPost, by, expires, reason)
VALUES           ($1,    $2, $3,      $4, $5,      $6)
ON CONFLICT DO NOTHING
RETURNING log_moderation(0::smallint, $1, $3, $4)
