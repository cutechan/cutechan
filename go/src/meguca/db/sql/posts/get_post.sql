SELECT id, time, auth, body, links, commands, op, board
FROM posts
WHERE id = $1
