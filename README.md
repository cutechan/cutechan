# cutechan [![Build Status](https://travis-ci.org/cutechan/cutechan.svg?branch=master)](https://travis-ci.org/cutechan/cutechan)

K-pop oriented imageboard started as [meguca](https://github.com/bakape/meguca) fork.

## Prepare

```bash
docker build -f Dockerfile-dev -t cutechan-dev .
docker run -it --name cutechan-dev -v $PWD:/cutechan -p 127.0.0.1:8001:8001 cutechan-dev
/etc/init.d/postgresql start
```

## Build

- `make` to build everything (`make client` and `make server` to build separately)
- `make client-watch` to rebuild client on changes

## Setup

- `make server-config` to init config
- `make server-db` to init database
- `make serve` and open http://localhost:8001 in a browser
- Login into the `admin` account with the password `password`
- Change the default password
- Create a board from the administration panel
- Configure server from the administration panel

## License

[AGPLv3+](LICENSE).
