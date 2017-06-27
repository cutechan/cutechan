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

client: client-deps client-build

client-deps:
	npm install --progress false --depth 0
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

client-build:
	$(gulp)

watch:
	$(gulp) -w

server: server-deps server-build

server-deps:
	go get -v \
		github.com/valyala/quicktemplate/qtc \
		github.com/jteeuwen/go-bindata/... \
		github.com/mailru/easyjson/...
	go list -f '{{.Deps}}' meguca | tr -d '[]' | xargs go get -v

server-build:
	go generate meguca/...
	go build -v -o $(binary) meguca

update-deps:
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

test-no-race:
	go test -p 1 meguca/...

test-custom:
	go test meguca/... $(f)

upgrade-v4: generate
	go get -v github.com/dancannon/gorethink
	$(MAKE) -C scripts/migration/3to4 upgrade

client-clean:
	rm -rf www/js www/css/*.css www/css/maps www/lang

server-clean:
	rm -rf go/src/github.com go/src/golang.org go/bin go/pkg \
		go/src/meguca/common/*_easyjson.go \
		go/src/meguca/config/*_easyjson.go \
		go/src/meguca/templates/*.qtpl.go

test-clean:
	rm -rf go/multipart-*

clean: client-clean server-clean test-clean
	rm -rf .build .ffmpeg .package cutechan-*.zip cutechan-*.tar.xz cutechan cutechan.exe
	$(MAKE) -C scripts/migration/3to4 clean
ifeq ($(is_windows), true)
	rm -rf /.meguca_build *.dll
endif

distclean: clean
	rm -rf images db.db error.log
