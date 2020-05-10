select max(replyTime) from threads
  where board = $1
