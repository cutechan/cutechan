select readOnly, textOnly, disableRobots, id, title, notice, rules
	from boards
	where id = $1
