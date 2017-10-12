SELECT
  t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime, t.subject,
  t.id, p.time, p.auth, p.body, p.links, p.commands
FROM threads t
JOIN posts p ON p.id = t.id
WHERE t.id = $1
