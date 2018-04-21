SELECT board FROM staff
WHERE account = $1 AND position = 'owners'
ORDER BY board
