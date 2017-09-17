export NODE_BIN=$(PWD)/node_modules/.bin
export HTMLMIN=$(NODE_BIN)/html-minifier
export GULP=$(NODE_BIN)/gulp
ifeq ($(GOPATH),)
	export PATH:=$(PATH):$(PWD)/go/bin
	export GOPATH=$(PWD)/go
	export TMPDIR=$(PWD)/go
else
	export PATH:=$(PATH):$(GOPATH)/bin
	export GOPATH:=$(GOPATH):$(PWD)/go
endif

.PHONY: smiles tags

all: deps templates smiles client server

deps:
	npm install --progress=false
	go get -v \
		github.com/valyala/quicktemplate/qtc \
		github.com/jteeuwen/go-bindata/... \
		github.com/mailru/easyjson/...
	go generate meguca/...
	go list -f '{{.Deps}}' meguca | tr -d '[]' | xargs go get -v

update-deps:
	npm update
	go get -u -v \
		github.com/valyala/quicktemplate/qtc \
		github.com/jteeuwen/go-bindata/... \
		github.com/mailru/easyjson/...
	go list -f '{{.Deps}}' meguca |\
		tr -d '[]' |\
		xargs go list -e -f '{{if not .Standard}}{{.ImportPath}}{{end}}' |\
		grep -v meguca |\
		xargs go get -u -v

templates:
	$(HTMLMIN) --collapse-whitespace --collapse-inline-tag-whitespace \
		--input-dir mustache --output-dir mustache-pp

smiles:
	$(GULP) smiles

client:
	$(GULP)

client-watch:
	$(GULP) -w

server:
	go generate meguca/...
	go build -v -o cutechan meguca

deb: clean templates smiles client server
	-patchelf --replace-needed libGraphicsMagick.so.3 libGraphicsMagick-Q16.so.3 cutechan
	mkdir deb_dist
	cp -a DEBIAN deb_dist
	mkdir -p deb_dist/usr/share/cutechan/www
	cp -a dist/* deb_dist/usr/share/cutechan/www
	mkdir -p deb_dist/usr/bin
	cp -a cutechan deb_dist/usr/bin
	chmod -R go+rX deb_dist
	fakeroot dpkg-deb -z0 -b deb_dist cutechan.deb

test:
	go test -race -p 1 meguca/...

test-no-race:
	go test -p 1 meguca/...

test-custom:
	go test meguca/... $(f)

test-build:
	go build -o /dev/null meguca

fmt:
	go fmt meguca/...

tags:
	ctags -R go/src/meguca ts

clean: templates-clean smiles-clean client-clean server-clean deb-clean test-clean

templates-clean:
	rm -rf mustache-pp

smiles-clean:
	rm -rf smiles-pp

client-clean:
	rm -rf dist

server-clean:
	rm -rf cutechan \
		go/src/meguca/**/bin_data.go \
		go/src/meguca/common/*_easyjson.go \
		go/src/meguca/config/*_easyjson.go \
		go/src/meguca/templates/*.qtpl.go

deb-clean:
	rm -rf deb_dist *.deb

test-clean:
	rm -rf go/multipart-* \
		go/src/meguca/imager/uploads \
		go/src/meguca/imager/assets/uploads \
		go/src/meguca/imager/testdata/thumb_*.jpg \
		go/src/meguca/imager/testdata/thumb_*.png

distclean: clean
	rm -rf uploads
	rm -rf node_modules package-lock.json
	rm -rf go/src/github.com go/src/golang.org go/bin go/pkg tags
