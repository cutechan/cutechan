SELECT board, account, position FROM staff
WHERE board = ANY($1)
ORDER BY account
