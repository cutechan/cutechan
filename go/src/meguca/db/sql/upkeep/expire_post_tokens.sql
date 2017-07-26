delete from post_tokens
	where expires < now()
