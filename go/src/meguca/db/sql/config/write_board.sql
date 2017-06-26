insert into boards (
	id, readOnly, textOnly, disableRobots, created, title,	notice, rules
)
	values ($1, $2, $3, $4, $5, $6, $7, $8)
	returning pg_notify('board_updated', $1)
