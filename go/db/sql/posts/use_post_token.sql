delete from post_tokens
  where id = $1 and expires > now()
  returning id
