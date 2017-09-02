create or replace function insert_thread(
  subject varchar(100),
  imageCtr bigint,
  editing bool,
  id bigint,
  board text,
  op bigint,
  now bigint,
  body varchar(2000),
  name varchar(50),
  trip char(10),
  auth varchar(20),
  password bytea,
  ip inet,
  SHA1 char(40),
  links bigint[][2],
  commands json[]
) returns void as $$
  insert into threads (
    board, id, postCtr, imageCtr, replyTime, bumpTime, subject
  )
    values (board, id, 1, imageCtr, now, now, subject);
  insert into posts (
    editing, id, board, op, time, body, name, trip, auth, password,
    ip, SHA1, links, commands
  )
    values (
      editing, id, board, op, now, body, name, trip, auth,
      password, ip, SHA1, links, commands
    );
$$ language sql;
