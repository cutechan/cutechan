update boards
	set
		readOnly = $2,
		textOnly = $3,
		disableRobots = $4,
		title = $5,
		notice = $6,
		rules = $7
	where id = $1
	returning pg_notify('board_updated', $1)
