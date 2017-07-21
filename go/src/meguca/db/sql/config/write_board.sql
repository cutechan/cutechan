insert into boards (
	id, created, title, readOnly
)
	values ($1, $2, $3, $4)
	returning pg_notify('board_updated', $1)
