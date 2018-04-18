SELECT
  t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime, t.subject,
  t.id, p.time, p.auth, a.id, a.name, p.body, p.links, p.commands
FROM threads t
JOIN posts p ON p.id = t.id
LEFT JOIN accounts a ON a.id = p.name
WHERE t.id = $1
