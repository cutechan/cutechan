# cutechan [![Build Status](https://travis-ci.org/cutechan/cutechan.svg?branch=master)](https://travis-ci.org/cutechan/cutechan)

K-pop oriented imageboard started as [meguca](https://github.com/bakape/meguca) fork.

## Runtime dependencies

* [PostgresSQL](https://www.postgresql.org/download/) >= 9.6
* ffmpeg >= 3.1 shared libraries (libavcodec, libavutil, libavformat, libswscale) compiled with:
    * libvpx
    * libvorbis
    * libopus
    * libtheora
    * libx264
    * libmp3lame
* GraphicsMagick shared library compiled with:
    * zlib
    * libpng
    * libjpeg
    * postscript

## Build dependencies

* [Go](https://golang.org/doc/install) >= 1.9.2 (for building server)
* [Node.js](https://nodejs.org/) >= 8.0 (for building client)
* GCC or Clang
* git
* make
* pthread
* pkg-config
* ffmpeg and GraphicsMagick development files
* optipng

## Build

`make`

## Setup

* See `./cutechan help` for server operation
* Login into the `admin` account via the infinity symbol in the top banner with
  the password `password`
* Change the default password
* Create a board from the administration panel
* Configure server from the administration panel

## Development

* `./cutechan` or `./cutechan debug` run the server in development mode
* `make client` and `make server` build the client and server separately
* `make client-watch` watches the file system for changes and incrementally
  rebuilds the client
* `make clean` removes files from the previous compilation

## License

[AGPL-3.0](LICENSE)
