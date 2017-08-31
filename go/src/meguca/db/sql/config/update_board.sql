update boards
	set
		title = $2,
		readOnly = $3,
		modOnly = $4
	where id = $1
	returning pg_notify('board_updated', $1)
