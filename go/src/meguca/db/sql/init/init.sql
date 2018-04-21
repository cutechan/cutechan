create table main (
  id text primary key,
  val text not null
);
insert into main (id, val) values
  ('version', %d),
  ('config', '%s');

create table accounts (
  id varchar(20) primary key,
  password bytea not null,
  name varchar(20) NOT NULL UNIQUE,
  settings jsonb NOT NULL
);

create table sessions (
  account varchar(20) not null references accounts on delete cascade,
  token text not null,
  expires timestamp not null,
  primary key (account, token)
);

CREATE INDEX sessions_token ON sessions (token);

create table bans (
  board text not null,
  ip inet not null,
  forPost bigint default 0,
  by varchar(20) not null,
  reason text not null,
  expires timestamp not null,
  primary key (ip, board)
);

create table mod_log (
  type smallint not null,
  board text not null,
  id bigint not null,
  by varchar(20) not null,
  created timestamp default (now() at time zone 'utc')
);
create index mod_log_board on mod_log (board);
create index mod_log_created on mod_log (created);

create table images (
  apng boolean not null,
  audio boolean not null,
  video boolean not null,
  fileType smallint not null,
  thumbType smallint not null,
  dims smallint[4] not null,
  length int not null,
  size int not null,
  MD5 char(22) not null,
  SHA1 char(40) primary key,
  Title varchar(300) not null,
  Artist varchar(100) not null
);

create table image_tokens (
  token char(86) not null primary key,
  SHA1 char(40) not null references images on delete cascade,
  expires timestamp not null
);

CREATE TABLE boards (
  id text PRIMARY KEY,
  modOnly boolean NOT NULL,
  settings jsonb NOT NULL
);

create table staff (
  board text not null references boards on delete cascade,
  account varchar(20) not null references accounts on delete cascade,
  position varchar(50) not null
);
create index staff_board on staff (board);
create index staff_account on staff (account);

create table banners (
  board text not null references boards on delete cascade,
  id smallint not null,
  data bytea not null,
  mime text not null
);

create sequence post_id;

create table threads (
  sticky boolean default false,
  board text not null references boards on delete cascade,
  id bigint primary key,
  postCtr bigint not null,
  imageCtr bigint not null,
  bumpTime bigint not null,
  replyTime bigint not null,
  subject varchar(100) not null
);
create index threads_board on threads (board);
create index bumpTime on threads (bumpTime);
create index replyTime on threads (replyTime);
create index sticky on threads (sticky);

create table posts (
  editing boolean,
  deleted boolean,
  banned boolean,
  sage boolean,
  id bigint primary key,
  op bigint not null references threads on delete cascade,
  time bigint not null,
  board text not null,
  trip char(10),
  auth varchar(20),
  SHA1 char(40) references images on delete set null,
  name varchar(50),
  body text not null,
  password bytea,
  ip inet,
  links bigint[][2],
  commands json[]
);
create index op on posts (op);
create index image on posts (SHA1);
create index editing on posts (editing);
create index ip on posts (ip);

create table news (
  id bigserial primary key,
  subject varchar(100) not null,
  body varchar(2000) not null,
  imageName varchar(200),
  time timestamp default (now() at time zone 'utc')
);

create table post_tokens (
  id char(20) not null primary key,
  ip inet not null,
  expires timestamp not null
);

CREATE TABLE post_files (
  post_id bigint REFERENCES posts ON DELETE CASCADE,
  file_hash char(40) REFERENCES images,
  id bigserial PRIMARY KEY
);
CREATE INDEX post_files_file_hash ON post_files (file_hash);

CREATE TABLE stickers (
  sha1 char(40) PRIMARY KEY REFERENCES images
);
CREATE TABLE tags (
  id bigserial PRIMARY KEY,
  name varchar(100) not null UNIQUE
);
CREATE TABLE sticker_tags (
  sticker_hash char(40) REFERENCES stickers ON DELETE CASCADE,
  tag_id bigint REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (sticker_hash, tag_id)
);
CREATE INDEX sticker_tags_tag_id ON sticker_tags (tag_id);
