select op, board, editing, banned, deleted, sage, id, time, body, name,
    trip, auth, links, commands, images.*
  from posts
  left outer join images
    on posts.SHA1 = images.SHA1
  where id = $1
