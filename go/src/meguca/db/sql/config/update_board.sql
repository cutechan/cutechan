update boards
	set
		readOnly = $2,
		textOnly = $3,
		title = $4,
		notice = $5,
		rules = $6
	where id = $1
	returning pg_notify('board_updated', $1)
