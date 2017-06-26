select readOnly, textOnly, id, title, notice, rules
	from boards
	where id = $1
