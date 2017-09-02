delete from threads
  where id = $1
  returning log_moderation(5::smallint, board, id, $2::varchar(20))
