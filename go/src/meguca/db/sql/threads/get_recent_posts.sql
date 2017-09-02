select id, time, editing from posts
  where op = $1
    and time > floor(extract(epoch from now())) - 900
  order by id asc
