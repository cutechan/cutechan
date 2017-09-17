CREATE OR REPLACE FUNCTION insert_thread(
  id bigint,
  now bigint,
  body text,
  auth varchar(20),
  links bigint[][2],
  op bigint,
  board text,
  ip inet,
  file_cnt bigint,
  subject varchar(100)
) RETURNS void AS $$

  INSERT INTO threads (board, id, postCtr, imageCtr, replyTime, bumpTime, subject)
  VALUES              (board, id, 1,       file_cnt, now,       now,      subject);

  INSERT INTO posts (id, board, op, time, body, auth, ip, links)
  VALUES            (id, board, op, now,  body, auth, ip, links);

$$ LANGUAGE SQL;
