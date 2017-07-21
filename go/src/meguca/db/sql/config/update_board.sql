update boards
	set
		title = $2
	where id = $1
	returning pg_notify('board_updated', $1)
