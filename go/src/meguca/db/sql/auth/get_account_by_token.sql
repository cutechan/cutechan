SELECT a.id, a.name, a.settings FROM sessions
JOIN accounts a ON a.id = account
WHERE token = $1
