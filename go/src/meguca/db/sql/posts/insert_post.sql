insert into posts (
    editing, spoiler, id, board, op, time, body, name, trip, auth, password,
    ip, SHA1, links, commands, sage
  )
  values ($1,  $2,  $3,  $4,  $5,  $6,  $7,  $8,  $9,  $10, $11, $12, $13,  $14, $15, $16)
  returning bump_thread($5, true, false, not $16, $13 is not null)
