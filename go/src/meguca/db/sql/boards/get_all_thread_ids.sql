select t.id from threads as t
	inner join boards as b
		on b.id = t.board
	where NOT b.modOnly
	order by bumpTime desc
