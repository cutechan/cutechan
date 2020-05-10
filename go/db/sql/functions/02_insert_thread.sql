CREATE OR REPLACE FUNCTION insert_thread(
  id bigint,
  op bigint,
  now bigint,
  board text,
  auth varchar(20),
  name varchar(50),
  body text,
  ip inet,
  links bigint[][2],
  commands json[],
  file_cnt bigint,
  subject varchar(100)
) RETURNS void AS $$

  INSERT INTO threads (board, id, postCtr, imageCtr, replyTime, bumpTime, subject)
  VALUES              (board, id, 1,       file_cnt, now,       now,      subject);

  INSERT INTO posts (id, op, time, board, auth, name, body, ip, links, commands)
  VALUES            (id, op, now,  board, auth, name, body, ip, links, commands);

$$ LANGUAGE SQL;
