update boards
	set
		title = $2,
		notice = $3,
		rules = $4
	where id = $1
	returning pg_notify('board_updated', $1)
