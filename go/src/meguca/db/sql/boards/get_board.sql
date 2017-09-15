select t.sticky, t.board, t.postCtr, t.imageCtr, t.replyTime, t.bumpTime,
    t.subject,
    t.id, p.time, p.body, p.auth, p.links,
    i.*
  from threads as t
  inner join posts as p
    on t.id = p.id
  left outer join images as i
    on p.SHA1 = i.SHA1
  where t.board = $1
  order by
    sticky desc,
    bumpTime desc
