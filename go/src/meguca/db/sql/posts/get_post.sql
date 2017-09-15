select op, board, id, time, body, auth, links, images.*
  from posts
  left outer join images
    on posts.SHA1 = images.SHA1
  where id = $1
