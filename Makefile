export GOBIN = $(PWD)/bin
export PATH := $(PATH):$(GOBIN)
export NODEBIN = $(PWD)/node_modules/.bin
export HTMLMIN = $(NODEBIN)/html-minifier
export GULP = $(NODEBIN)/gulp

all: client server

node_modules:
	npm install

mustache-pp/%.mustache: mustache/%.mustache
	@mkdir -p mustache-pp
	$(HTMLMIN) --collapse-whitespace --collapse-inline-tag-whitespace -o $@ $<

mustache-pp: node_modules $(subst mustache/,mustache-pp/,$(wildcard mustache/*.mustache))

smiles-pp: node_modules $(wildcard smiles/*.png)
	$(GULP) smiles

client: mustache-pp smiles-pp
	$(GULP)

client-watch: mustache-pp smiles-pp
	$(GULP) -w

bin/go-bindata:
	cd go; go install github.com/kevinburke/go-bindata/go-bindata

bin/easyjson:
	cd go; go install github.com/mailru/easyjson/easyjson

bin/qtc:
	cd go; go install github.com/valyala/quicktemplate/qtc

GENSRC  = $(shell find go -type f -name '*.go' | xargs grep -l '^//go:generate')
GENSRC += $(shell find go/db/sql -type f -name '*.sql')
GENSRC += $(wildcard go/templates/*.qtpl)
GENSRC += $(wildcard po/*.po)
go/db/bin_data.go: bin/go-bindata bin/easyjson bin/qtc mustache-pp $(GENSRC)
	cd go; go generate ./...

server: smiles-pp go/db/bin_data.go
	cd go; go install ./cmd/...

serve: server
	cutechan --debug --cfg cutechan.toml

server-config:
	cp cutechan.toml.example cutechan.toml

server-db:
	sudo -u postgres psql -c "CREATE USER meguca WITH PASSWORD 'meguca';"
	sudo -u postgres createdb meguca -O meguca

deb: clean templates smiles client server
	-patchelf --replace-needed libGraphicsMagick.so.3 libGraphicsMagick-Q16.so.3 go/bin/cutethumb
	mkdir deb_dist
	cp -a DEBIAN deb_dist
	mkdir -p deb_dist/usr/share/cutechan/www
	cp -a dist/* deb_dist/usr/share/cutechan/www
	mkdir -p deb_dist/usr/share/cutechan/data
	-cp -a geoip deb_dist/usr/share/cutechan/data
	-cp -a go/src/github.com/Kagami/kpopnet/data/models deb_dist/usr/share/cutechan/data
	cp -a go/src/github.com/Kagami/kpopnet/data/profiles deb_dist/usr/share/cutechan/data
	mkdir -p deb_dist/usr/bin
	cp -a go/bin/cute* deb_dist/usr/bin
	chmod -R go+rX deb_dist
	dpkg-deb --root-owner-group -z0 -b deb_dist cutechan.deb

gofmt:
	cd go; go fmt ./...

clean: templates-clean smiles-clean client-clean server-clean deb-clean

templates-clean:
	rm -rf mustache-pp

smiles-clean:
	rm -rf smiles-pp go/smiles

client-clean:
	rm -rf labels-pp dist

server-clean:
	rm -rf bin go/*/bin_data.go go/*/*_easyjson.go go/templates/*.qtpl.go

deb-clean:
	rm -rf deb_dist cutechan.deb
