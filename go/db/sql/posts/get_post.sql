SELECT p.id, p.time, p.auth, a.id, a.name, p.body, p.links, p.commands, p.op, p.board
FROM posts p
LEFT JOIN accounts a ON a.id = p.name
WHERE p.id = $1
