INSERT INTO posts (id, board, op, time, body, auth, ip, links)
VALUES            ($1, $2,    $3, $4,   $5,   $6,   $7, $8)
RETURNING bump_thread($3, true, false, true, $9)
