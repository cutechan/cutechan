CREATE OR REPLACE FUNCTION bump_thread(
  id bigint,
  addPost bool,
  delPost bool,
  bump bool,
  file_cnt bigint
) RETURNS void AS $$

  UPDATE threads SET
    replyTime = floor(extract(epoch from now())),

    bumpTime = CASE
      WHEN bump THEN
        CASE WHEN postCtr <= 500
          THEN floor(extract(epoch from now()))
          ELSE bumpTime
        END
      ELSE bumpTime
    END,

    postCtr = CASE
      WHEN addPost THEN postCtr + 1
      WHEN delPost THEN postCtr - 1
      ELSE postCtr
    END,

    imageCtr = CASE
      WHEN addPost THEN imageCtr + file_cnt
      WHEN delPost THEN imageCtr - file_cnt
      ELSE imageCtr
    END

  WHERE id = bump_thread.id;

$$ LANGUAGE SQL;
