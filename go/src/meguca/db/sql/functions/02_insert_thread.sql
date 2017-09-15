CREATE OR REPLACE FUNCTION insert_thread(
  id bigint,
  board text,
  op bigint,
  now bigint,
  body varchar(2000),
  auth varchar(20),
  ip inet,
  links bigint[][2],
  file_cnt bigint,
  subject varchar(100)
) RETURNS void AS $$

  INSERT INTO threads (board, id, postCtr, imageCtr, replyTime, bumpTime, subject)
  VALUES              (board, id, 1,       file_cnt, now,       now,      subject);

  INSERT INTO posts (id, board, op, time, body, auth, ip, links)
  VALUES            (id, board, op, now,  body, auth, ip, links);

$$ LANGUAGE SQL;
