select t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime,
    t.subject,
    t.id, p.time, p.body, p.auth, p.links,
    i.*
  from threads as t
  inner join boards as b
    on b.id = t.board
  inner join posts as p
    on t.id = p.id
  left outer join images as i
    on p.SHA1 = i.SHA1
  where NOT b.modOnly
  order by bumpTime desc
