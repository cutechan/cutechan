SELECT id, time, auth, name, body, links, commands, op, board
FROM posts
WHERE id = $1
