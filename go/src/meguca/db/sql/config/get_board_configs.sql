select readOnly, textOnly, forcedAnon, disableRobots, id, title, notice, rules
	from boards
	where id = $1
