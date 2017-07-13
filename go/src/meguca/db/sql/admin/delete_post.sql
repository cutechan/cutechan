delete from posts
	where id = $1
	returning log_moderation(2::smallint, board, id, $2::varchar(20)),
		bump_thread(op, false, true, false, SHA1 is not null)
