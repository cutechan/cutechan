insert into boards (
	id, created, title
)
	values ($1, $2, $3)
	returning pg_notify('board_updated', $1)
