INSERT INTO posts (id, board, op, time, body, auth, ip, links, SHA1)
VALUES            ($1, $2,    $3, $4,   $5,   $6,   $7, $8,    $9)
RETURNING bump_thread($1, true, false, true, $10)
