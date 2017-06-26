export node_bins=$(PWD)/node_modules/.bin
export uglifyjs=$(node_bins)/uglifyjs
export gulp=$(node_bins)/gulp
export is_windows=false
binary=cutechan
ifeq ($(GOPATH),)
	export PATH:=$(PATH):$(PWD)/go/bin
	export GOPATH=$(PWD)/go
	export TMPDIR=$(PWD)/go
else
	export PATH:=$(PATH):$(GOPATH)/bin
	export GOPATH:=$(GOPATH):$(PWD)/go
endif

# Differentiate between Unix and mingw builds
ifeq ($(OS), Windows_NT)
	export PKG_CONFIG_PATH:=$(PKG_CONFIG_PATH):/mingw64/lib/pkgconfig/
	export PKG_CONFIG_LIBDIR=/mingw64/lib/pkgconfig/
	export PATH:=$(PATH):/mingw64/bin/
	export is_windows=true
	binary=cutechan.exe
endif

all: client server

client: client_deps client_vendor client_build

client_deps:
	npm install --progress false --depth 0

client_vendor:
	mkdir -p www/js/vendor
	cp \
		node_modules/dom4/build/dom4.js \
		node_modules/core-js/client/core.min.js \
		node_modules/core-js/client/core.min.js.map \
		node_modules/babel-polyfill/dist/polyfill.min.js \
		node_modules/proxy-polyfill/proxy.min.js \
		www/js/vendor
	$(uglifyjs) node_modules/whatwg-fetch/fetch.js -o www/js/vendor/fetch.js
	$(uglifyjs) node_modules/almond/almond.js -o www/js/vendor/almond.js

client_build:
	$(gulp)

watch:
	$(gulp) -w

server: server_deps server_gen server_build

server_deps:
	go get -v \
		github.com/valyala/quicktemplate/qtc \
		github.com/jteeuwen/go-bindata/... \
		github.com/mailru/easyjson/...
	go list -f '{{.Deps}}' meguca | tr -d '[]' | xargs go get -v

server_gen:
	rm -f go/src/meguca/common/*_easyjson.go
	rm -f go/src/meguca/config/*_easyjson.go
	rm -f go/src/meguca/templates/*.qtpl.go
	go generate meguca/...

server_build:
	go build -v -o $(binary) meguca

update_deps:
	go get -u -v \
		github.com/valyala/quicktemplate/qtc \
		github.com/jteeuwen/go-bindata/... \
		github.com/mailru/easyjson/...
	go list -f '{{.Deps}}' meguca |\
		tr -d '[]' |\
		xargs go list -e -f '{{if not .Standard}}{{.ImportPath}}{{end}}' |\
		grep -v 'meguca' |\
		xargs go get -u -v
	npm update

test:
	go test -race -p 1 meguca/...

test_no_race:
	go test -p 1 meguca/...

test_custom:
	go test meguca/... $(f)

upgrade_v4: generate
	go get -v github.com/dancannon/gorethink
	$(MAKE) -C scripts/migration/3to4 upgrade

client_clean:
	rm -rf www/js www/css/*.css www/css/maps www/lang

server_clean:
	rm -rf go/src/github.com go/src/golang.org go/bin go/pkg

test_clean:
	rm -rf go/multipart-*

clean: client_clean server_clean test_clean
	rm -rf .build .ffmpeg .package cutechan-*.zip cutechan-*.tar.xz cutechan cutechan.exe
	$(MAKE) -C scripts/migration/3to4 clean
ifeq ($(is_windows), true)
	rm -rf /.meguca_build *.dll
endif

dist_clean: clean
	rm -rf images db.db error.log
