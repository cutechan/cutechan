"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const del = require("del");
const merge = require("merge-stream");
const uglifyes = require("uglify-es");
const gulp = require("gulp");
const concat = require("gulp-concat");
const gulpif = require("gulp-if");
const tap = require("gulp-tap");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const rjsOptimize = require("gulp-requirejs-optimize");
const spritesmith = require("gulp.spritesmith");
const less = require("gulp-less");
const po2json = require("gulp-po2json");
const uglify = require("gulp-uglify/composer")(uglifyes, console);
const livereload = require("gulp-livereload");

// Development mode.
const dev = process.env.NODE_ENV === "development";
// Keep script alive and rebuild on file changes.
const watch = process.argv.includes("-w");

const LANGS_GLOB = "po/*.po";
const TEMPLATES_GLOB = "mustache-pp/*.mustache";
const SMILESJS_GLOB = "smiles-pp/smiles.js";

const SMILES_TMP_DIR = path.resolve("smiles-pp");
const LABELS_TMP_DIR = path.resolve("labels-pp");
const DIST_DIR = path.resolve("dist");
const STATIC_DIR = path.join(DIST_DIR, "static");
const JS_DIR = path.join(STATIC_DIR, "js");
const CSS_DIR = path.join(STATIC_DIR, "css");
const IMG_DIR = path.join(STATIC_DIR, "img");
const FONTS_DIR = path.join(STATIC_DIR, "fonts");
const TSC_TMP_FILE = path.join(JS_DIR, "_app.js");

// Tasks which needs to finish before main tasks.
const preTasks = [];

// Dependency tasks for the default tasks.
const tasks = [];

// Typescript compiler spawned in watch mode.
let tsc = null;

// Make sure to kill tsc child on exit.
function killTsc() {
  if (tsc) {
    tsc.kill();
    tsc = null;
  }
}
process.on("exit", killTsc);
process.on("SIGTERM", (code) => {
  killTsc();
  process.exit(code);
});

// Simply log the error on continuos builds, but fail the build and exit
// with an error status, if failing a one-time build. This way we can
// use failure to build the client to not pass Travis CL tests.
function handleError(err) {
  if (watch) {
    console.error(err.message);
    if (this) {
      this.emit("end");
    }
  } else {
    throw err;
  }
}

// Create a new gulp task and set it to execute on default and
// incrementally.
function createTask(name, path, task, watchPath) {
  tasks.push(name);
  gulp.task(name, () => task(gulp.src(path)));

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    gulp.watch(watchPath || path, gulp.series(name));
  }
}

// Convert raw po2json format to cutechan's own format.
function raw2custom(src) {
  src = JSON.parse(src);
  let getPluralN = "";
  const messages = {};
  Object.keys(src).forEach((k) => {
    const v = src[k];
    if (k === "") {
      // Parsing plural function.
      // It's ok to fail on any error here.
      const rawFn = v["plural-forms"];
      const body = rawFn.match(/plural=([^;]+)/)[1];
      getPluralN = `function(n) { return ${body}; }`;
    } else if (v[0] !== null) {
      // Plural translation.
      messages[k] = v.slice(1);
    } else {
      // Singular translation.
      messages[k] = v[1];
    }
  });
  return `{getPluralN: ${getPluralN}, messages: ${JSON.stringify(messages)}}`;
}

function langs() {
  return gulp
    .src(LANGS_GLOB)
    .pipe(po2json())
    .on("error", handleError)
    .pipe(
      tap(function (file) {
        const name = JSON.stringify(path.basename(file.path, ".json"));
        let lang = "";
        try {
          lang = raw2custom(file.contents.toString());
        } catch (err) {
          return handleError(err);
        }
        file.contents = Buffer.from(`langs[${name}] = ${lang};`);
      })
    )
    .pipe(concat("langs.js"))
    .pipe(
      tap(function (file) {
        file.contents = Buffer.concat([
          Buffer.from('define("cc-langs", function() {\n'),
          Buffer.from("var langs = {};\n"),
          file.contents,
          Buffer.from("\nreturn langs;\n"),
          Buffer.from("});"),
        ]);
      })
    );
}

function templates() {
  return gulp
    .src(TEMPLATES_GLOB)
    .pipe(
      tap(function (file) {
        const name = JSON.stringify(path.basename(file.path, ".mustache"));
        const template = JSON.stringify(file.contents.toString());
        file.contents = Buffer.from(`templates[${name}] = ${template};`);
      })
    )
    .pipe(concat("templates.js"))
    .pipe(
      tap(function (file) {
        file.contents = Buffer.concat([
          Buffer.from('define("cc-templates", function() {\n'),
          Buffer.from("var templates = {};\n"),
          file.contents,
          Buffer.from("\nreturn templates;\n"),
          Buffer.from("});"),
        ]);
      })
    );
}

function typescriptGulp(opts) {
  const project = ts.createProject("tsconfig.json", opts);
  return project
    .src()
    .pipe(project(ts.reporter.nullReporter()))
    .on("error", handleError);
}

function typescriptTsc() {
  return gulp.src(TSC_TMP_FILE);
}

function injectLivereload() {
  const Vinyl = require("vinyl");
  const through = require("through2");
  const stream = through.obj(function (chunk, enc, cb) {
    chunk.contents = Buffer.concat([
      Buffer.from("(function() {\n"),
      Buffer.from('var script = document.createElement("script");\n'),
      Buffer.from('script.src = "http://localhost:35729/livereload.js";\n'),
      Buffer.from("document.body.appendChild(script);\n"),
      Buffer.from("})();"),
    ]);
    cb(null, new Vinyl(chunk));
  });
  stream.end({ path: path.resolve("livereload.js") });
  return stream;
}

function buildClient(tsOpts) {
  const typescript = watch ? typescriptTsc : typescriptGulp;
  const stream = merge(langs(), templates(), typescript(tsOpts));
  if (watch) {
    stream.add(injectLivereload());
  }
  return stream.pipe(sourcemaps.init()).pipe(concat(tsOpts.outFile));
}

// Build modern client.
gulp.task("es6", () =>
  buildClient({ target: "ES6", outFile: "app.js" })
    .pipe(
      gulpif(
        !dev,
        uglify({
          mangle: { safari10: true },
          compress: { inline: 1 },
        })
      )
    )
    .pipe(sourcemaps.write("maps"))
    .pipe(gulp.dest(JS_DIR))
    .pipe(gulpif("**/*.js", livereload()))
);
tasks.push("es6");

// Build legacy ES5 client for old browsers.
gulp.task("es5", () =>
  buildClient({ target: "ES5", outFile: "app.es5.js" })
    .pipe(uglify())
    .pipe(sourcemaps.write("maps"))
    .pipe(gulp.dest(JS_DIR))
);
if (!dev) {
  tasks.push("es5");
}

let tscDone = false;

// Much faster than gulp-typescript, see:
// https://github.com/ivogabe/gulp-typescript/issues/549
function spawnTsc() {
  return new Promise((resolve, reject) => {
    tsc = spawn(
      "node_modules/.bin/tsc",
      ["-w", "-p", "tsconfig.json", "--outFile", TSC_TMP_FILE],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
      .on("error", (err) => {
        tsc = null;
        handleError(err);
      })
      .on("exit", (code) => {
        tsc = null;
        handleError(new Error(`tsc exited with ${code}`));
      });

    // Make tsc output gulp-alike.
    // Too hacky but whatever, all of this is a big hack.
    function logger(data) {
      // Might be buffer.
      data = data.toString();
      // Remove terminal reset.
      data = data.replace(/\x1bc/g, "");
      // Remove extra newlines.
      data = data.replace(/\n+$/, "");
      // Finally output "fixed" log messages.
      if (data.match(/\berror\b/)) {
        const err = new Error(data);
        err.name = "TypeScript error";
        handleError(err);
      } else {
        console.log(data);
      }

      if (
        !tscDone &&
        data.includes("Watching for file changes") &&
        fs.existsSync(TSC_TMP_FILE)
      ) {
        tscDone = true;
        resolve();
      }
    }
    tsc.stdout.on("data", logger);
    tsc.stderr.on("data", logger);
  });
}

gulp.task("tsc", () =>
  spawnTsc().then(() => {
    gulp.watch(
      [LANGS_GLOB, TEMPLATES_GLOB, SMILESJS_GLOB, TSC_TMP_FILE],
      gulp.series("es6")
    );
  })
);
if (watch) {
  preTasks.push("tsc");
}

function getSpriteHash(fpath) {
  const data = fs.readFileSync(fpath);
  return crypto.createHash("md5").update(data).digest("hex").slice(0, 10);
}

function replaceFile(fpath, what, to) {
  let data = fs.readFileSync(fpath, "utf8");
  data = data.replace(what, to);
  fs.writeFileSync(fpath, data);
}

// Special task, run separately.
gulp.task("smiles", () => {
  del.sync("smiles-pp/*.png");
  let hash = "";
  const smileNames = fs.readdirSync("smiles");
  const smileIds = smileNames
    .filter((n) => /^[a-z0-9_]+\.png$/.test(n))
    .map((n) => n.slice(0, -4))
    .sort();
  assert.equal(smileIds.length * 2, smileNames.length, "Smiles mismatch");
  // spritesmith requires correct sorting.
  const smilePaths = [];
  smileIds.forEach((id) =>
    smilePaths.push(`smiles/${id}.png`, `smiles/${id}@2x.png`)
  );
  return (
    gulp
      .src(smilePaths)
      .pipe(
        spritesmith({
          imgName: "__smiles.png",
          cssName: "smiles.css",
          retinaSrcFilter: "smiles/*@2x.png",
          retinaImgName: "__smiles@2x.png",
          // https://github.com/twolfson/gulp.spritesmith/issues/97
          padding: 1,
          cssOpts: {
            cssSelector: (s) => ".smile-" + s.name,
          },
        })
      )
      // This is slightly ineffecient because we read/write files twice but
      // they are quite small so it's not that bad.
      // XXX(Kagami): Needs explicit CSS dest.
      .pipe(
        gulpif("*.css", gulp.dest(SMILES_TMP_DIR), gulp.dest(SMILES_TMP_DIR))
      )
      .pipe(
        gulpif(
          "*.png",
          tap(function ({ basename, path: fpath }) {
            // gulp-imagemin requires 240+ deps, fuck that shit.
            const p = spawnSync(
              "optipng",
              ["-quiet", "-strip", "all", "-out", basename.slice(1), basename],
              { cwd: SMILES_TMP_DIR, stdio: "inherit" }
            );
            if (p.error) return handleError(p.error);
            if (p.status)
              return handleError(new Error(`optipng exited with ${p.status}`));
            // Fix paths.
            // Sprite images are always synced so use hash of one of them.
            if (!hash) {
              hash = getSpriteHash(fpath);
              replaceFile(
                "smiles-pp/smiles.css",
                /__smiles/g,
                `/static/img/smiles-${hash}`
              );
            }
            // Avoid corrupted sprite copy in dist/ via atomic rename.
            fs.renameSync(
              path.join(SMILES_TMP_DIR, basename.slice(1)),
              path.join(SMILES_TMP_DIR, `smiles-${hash}${basename.slice(8)}`)
            );
          })
        )
      )
      .on("end", () => {
        const jsSmiles = smileIds.map((id) => `"${id}"`).join(",");
        const jsModule = `
        // AUTOGENERATED, DO NOT EDIT
        export default new Set([${jsSmiles}]);
      `;
        fs.writeFileSync("smiles-pp/smiles.js", jsModule);

        const goSmiles = smileIds.map((id) => `"${id}":true`).join(",");
        const goModule = `
        // AUTOGENERATED, DO NOT EDIT
        package smiles
        var Smiles = map[string]bool{${goSmiles}}
      `;
        try {
          fs.mkdirSync("go/smiles");
        } catch (e) {
          /* skip */
        }
        fs.writeFileSync("go/smiles/smiles.go", goModule);
      })
  );
});

gulp.task("clean", () => del([LABELS_TMP_DIR, DIST_DIR]));

// Third-party dependencies and loader.
createTask("loader", "loader.js", (src) =>
  src
    .pipe(
      rjsOptimize({
        logLevel: 2,
        optimize: "none",
        cjsTranslate: true,
        paths: {
          almond: "node_modules/almond/almond",
          events: "node_modules/events/events",
          mustache: "node_modules/mustache/mustache",
          classnames: "node_modules/classnames/index",
          preact: "node_modules/preact/dist/preact",
          "textarea-caret": "node_modules/textarea-caret/index",
          vmsg: "node_modules/vmsg/vmsg.es5",
          hangeul: "node_modules/hangeul/index.es5",
        },
      })
    )
    .on("error", handleError)
    .pipe(gulpif(!dev, uglify()))
    .pipe(gulp.dest(JS_DIR))
);

// Polyfills and other deps.
createTask(
  "polyfills",
  [
    "node_modules/core-js/client/core.min.js",
    "node_modules/proxy-polyfill/proxy.min.js",
    "node_modules/dom4/build/dom4.js",
    "node_modules/whatwg-fetch/fetch.js",
    "node_modules/vmsg/vmsg.wasm",
    "node_modules/wasm-polyfill.js/wasm-polyfill.js",
  ],
  (src) =>
    src
      .pipe(
        gulpif(
          /core\.min\.js$/,
          rjsOptimize({
            logLevel: 2,
            optimize: "none",
          })
        )
      )
      .pipe(gulp.dest(JS_DIR))
);

gulp.task("labels", () =>
  gulp
    .src("node_modules/kpopnet/labels/icons/!(*@4x).png")
    .pipe(
      spritesmith({
        imgName: "labels.png",
        cssName: "labels.css",
        imgPath: "/static/img/labels.png",
        retinaSrcFilter: "**/*@2x.png",
        retinaImgName: "labels@2x.png",
        retinaImgPath: "/static/img/labels@2x.png",
        padding: 1,
        cssOpts: {
          cssSelector: (l) => ".label-" + l.name,
        },
      })
    )
    .pipe(gulpif("*.png", gulp.dest(IMG_DIR), gulp.dest(LABELS_TMP_DIR)))
);
preTasks.push("labels");

// Compile Less to CSS.
createTask(
  "css",
  "less/[^_]*.less",
  (src) =>
    src
      .pipe(sourcemaps.init())
      .pipe(less())
      .on("error", handleError)
      .pipe(
        gulpif(
          !dev,
          require("gulp-postcss")([
            // NOTE(Kagami): Takes ~1sec to just require them.
            require("autoprefixer")(),
            require("cssnano")({
              // Avoid fixing z-index which might be used in animation.
              zindex: false,
              // Avoid renaming counters which should be accessed from JS.
              reduceIdents: false,
              // Remove all comments.
              discardComments: { removeAll: true },
            }),
          ])
        )
      )
      .on("error", handleError)
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(CSS_DIR))
      .pipe(gulpif("**/*.css", livereload())),
  ["less/*.less", "smiles-pp/smiles*.css"]
);

// Static assets.
createTask(
  "assets",
  [
    "assets/**/*",
    "smiles-pp/smiles*.png",
    "node_modules/font-awesome/fonts/fontawesome-webfont.*",
  ],
  (src) =>
    src.pipe(
      gulpif(
        "smiles*.png",
        gulp.dest(IMG_DIR),
        gulpif("fontawesome*", gulp.dest(FONTS_DIR), gulp.dest(STATIC_DIR))
      )
    )
);

// Build everything.
gulp.task(
  "default",
  gulp.series("clean", gulp.parallel(...preTasks), gulp.parallel(...tasks))
);

if (watch) {
  livereload.listen({ quiet: true });
}
