INSERT INTO posts (id, time, body, auth, links, op, board, ip)
VALUES            ($1, $2,   $3,   $4,   $5,    $6, $7,    $8)
RETURNING bump_thread($6, true, false, true, $9)
