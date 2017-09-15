CREATE OR REPLACE FUNCTION insert_thread(
  id BIGINT,
  board TEXT,
  op BIGINT,
  now BIGINT,
  body VARCHAR(2000),
  auth VARCHAR(20),
  ip INET,
  links BIGINT[][2],
  SHA1 CHAR(40),
  file_cnt BIGINT,
  subject VARCHAR(100)
) RETURNS VOID AS $$

  INSERT INTO threads (board, id, postCtr, imageCtr, replyTime, bumpTime, subject)
  VALUES              (board, id, 1,       file_cnt, now,       now,      subject);

  INSERT INTO posts (id, board, op, time, body, auth, ip, SHA1, links)
  VALUES            (id, board, op, now,  body, auth, ip, SHA1, links);

$$ LANGUAGE SQL;
