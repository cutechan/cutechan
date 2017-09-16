SELECT
  t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime, t.subject,
  t.id, p.time, p.body, p.auth, p.links
FROM threads t
JOIN posts p ON p.id = t.id
WHERE t.id = $1
