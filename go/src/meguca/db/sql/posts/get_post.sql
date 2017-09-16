SELECT id, time, body, auth, links, op, board
FROM posts
WHERE id = $1
