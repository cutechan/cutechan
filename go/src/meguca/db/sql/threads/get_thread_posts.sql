WITH t AS (
  SELECT id, time, body, auth, links
  FROM posts
  WHERE op = $1 AND id != $1
  ORDER BY id DESC
  LIMIT $2
)
SELECT * FROM t ORDER BY id ASC
