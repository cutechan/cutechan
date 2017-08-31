insert into boards (
	id, created, title, readOnly, modOnly
)
	values ($1, $2, $3, $4, $5)
	returning pg_notify('board_updated', $1)
