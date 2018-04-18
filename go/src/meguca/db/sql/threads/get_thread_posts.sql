WITH t AS (
  SELECT p.id, p.time, p.auth, p.name, a.name, p.body, p.links, p.commands
  FROM posts p
  LEFT JOIN accounts a ON a.id = p.name
  WHERE op = $1 AND p.id != $1
  ORDER BY p.id DESC
  LIMIT $2
)
SELECT * FROM t ORDER BY id ASC
