SELECT
  t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime, t.subject,
  t.id, p.time, p.auth, p.name, p.body, p.links, p.commands,
  i.*
FROM threads t
JOIN boards b ON b.id = t.board
JOIN posts p ON p.id = t.id
LEFT JOIN LATERAL (SELECT file_hash FROM post_files WHERE post_id = t.id ORDER BY id LIMIT 1) pf ON true
LEFT JOIN images i ON i.sha1 = pf.file_hash
WHERE NOT b.modOnly
ORDER BY sticky DESC, bumpTime DESC
