INSERT INTO posts (id, op, time, board, auth, body, ip, links, commands)
VALUES            ($1, $2, $3,   $4,    $5,   $6,   $7, $8,    $9)
RETURNING bump_thread($2, true, false, true, $10)
