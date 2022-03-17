FROM ubuntu:21.10

RUN sed -i 's|http://archive.ubuntu.com/ubuntu/|http://mirror.yandex.ru/ubuntu/|g' /etc/apt/sources.list \
 && apt update && apt install -y --no-install-recommends libavformat58 libswscale5 libgraphicsmagick-q16-3 sudo ca-certificates tzdata && apt clean \
 && adduser --system --group --no-create-home --disabled-login --uid 2000 user \
 && adduser --system --group --no-create-home --disabled-login cutethumb \
 && echo 'user ALL=(cutethumb) NOPASSWD: /usr/bin/cutethumb' > /etc/sudoers.d/cutechan && chmod 440 /etc/sudoers.d/cutechan \
 && echo 'Set disable_coredump false' >> /etc/sudo.conf

EXPOSE 8001
USER user
VOLUME ["/uploads"]
ENTRYPOINT ["cutechan", "-H", "0.0.0.0", "--cfg", "/cutechan.toml"]
COPY bin/cutechan bin/cutethumb /usr/bin/
