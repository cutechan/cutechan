insert into boards (
	id, readOnly, textOnly, created, title,	notice, rules
)
	values ($1, $2, $3, $4, $5, $6, $7)
	returning pg_notify('board_updated', $1)
