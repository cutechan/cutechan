"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawn, spawnSync } = require("child_process");
const del = require("del");
const merge = require("merge-stream");
const stripAnsi = require("strip-ansi");
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
const rename = require("gulp-rename");
const uglify = require("gulp-uglify/composer")(uglifyes, console);
const notify = require("gulp-notify");
const livereload = require("gulp-livereload");
const runSequence = require("run-sequence");

// Keep script alive and rebuild on file changes.
const watch = process.argv.includes("-w");

// Build also tasks which are rarely needed.
const all = process.argv.includes("-a");

const LANGS_GLOB = "i18n/*.json";
const TEMPLATES_GLOB = "mustache-pp/*.mustache";
const SMILESJS_GLOB = "smiles-pp/smiles.js";

const DIST_DIR = path.resolve("dist");
const STATIC_DIR = path.join(DIST_DIR, "static");
const JS_DIR = path.join(STATIC_DIR, "js");
const CSS_DIR = path.join(STATIC_DIR, "css");
const IMG_DIR = path.join(STATIC_DIR, "img");
const FONTS_DIR = path.join(STATIC_DIR, "fonts");
const TSC_TMP_FILE = path.join(JS_DIR, "_app.js");

const KPOPNET_DIST_DIR = path.join(DIST_DIR, "kpopnet");
const KPOPNET_API_PREFIX = watch
  ? "http://localhost:8001/api"
  : "https://kpop.re/api";
const KPOPNET_FILE_PREFIX = watch
  ? "http://localhost:8001/uploads"
  : "https://up.kpop.re";
const KPOPNET_WEBPACK_CONFIG = path.resolve(__dirname,
  "go/src/github.com/Kagami/kpopnet",
  "webpack.config.js");

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

// Notify about errors.
const notifyError = notify.onError({
  title: "<%= error.name %>",
  message: "<%= options.stripAnsi(error.message) %>",
  templateOptions: {stripAnsi},
});

// Simply log the error on continuos builds, but fail the build and exit
// with an error status, if failing a one-time build. This way we can
// use failure to build the client to not pass Travis CL tests.
function handleError(err) {
  if (watch) {
    notifyError(err);
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
  gulp.task(name, () =>
    task(gulp.src(path))
  );

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    gulp.watch(watchPath || path, [name]);
  }
}

function langs() {
  return gulp.src(LANGS_GLOB)
    .pipe(tap(function(file) {
      const name = JSON.stringify(path.basename(file.path, ".json"));
      let lang = file.contents.toString();
      try {
        JSON.parse(lang);
      } catch(e) {
        handleError(e);
        return;
      }
      file.contents = new Buffer(`langs[${name}] = ${lang};`);
    }))
    .pipe(concat("langs.js"))
    .pipe(tap(function(file) {
      file.contents = Buffer.concat([
        new Buffer('define("cc-langs", ["exports"], function(exports) {\n'),
        new Buffer("var langs = {};\n"),
        file.contents,
        new Buffer("\nexports.default = langs;\n"),
        new Buffer("});\n"),
      ]);
    }));
}

function templates() {
  return gulp.src(TEMPLATES_GLOB)
    .pipe(tap(function(file) {
      const name = JSON.stringify(path.basename(file.path, ".mustache"));
      const template = JSON.stringify(file.contents.toString());
      file.contents = new Buffer(`templates[${name}] = ${template};`);
    }))
    .pipe(concat("templates.js"))
    .pipe(tap(function(file) {
      file.contents = Buffer.concat([
        new Buffer('define("cc-templates", ["exports"], function(exports) {\n'),
        new Buffer("var templates = {};\n"),
        file.contents,
        new Buffer("\nexports.default = templates;\n"),
        new Buffer("});\n"),
      ]);
    }));
}

function typescriptGulp(opts) {
  const project = ts.createProject("tsconfig.json", opts);
  return gulp.src("app.ts")
    .pipe(project(ts.reporter.nullReporter()))
    .on("error", handleError);
}

// Wait compilation result from tsc and pass it further.
function typescriptTsc() {
  const Vinyl = require("vinyl");
  const through = require("through2");
  const stream = through.obj(function(chunk, enc, cb) {
    function passFile() {
      try {
        chunk.contents = fs.readFileSync(chunk.path)
      } catch(e) {
        return false;
      }
      cb(null, new Vinyl(chunk));
      return true;
    }

    if (!passFile()) {
      const tid = setInterval(() => {
        if (passFile()) {
          clearInterval(tid);
        }
      }, 200);
    }
  });
  stream.end({
    base: process.cwd(),
    path: TSC_TMP_FILE,
  });
  return stream;
}

function buildClient(tsOpts) {
  const tsFn = watch ? typescriptTsc : typescriptGulp;
  return merge(langs(), templates(), tsFn(tsOpts))
    .pipe(sourcemaps.init())
    .pipe(concat(tsOpts.outFile));
}

// Builds the client files of the appropriate ECMAScript version.
function buildES6() {
  const name = "es6";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient({target: "ES6", outFile: "app.js"})
      .pipe(gulpif(!watch, uglify({mangle: {safari10: true}})))
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(JS_DIR))
      .pipe(gulpif("**/*.js", livereload()))
  );

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    // Much faster than gulp-typescript, see:
    // https://github.com/ivogabe/gulp-typescript/issues/549
    tsc = spawn("node_modules/.bin/tsc", [
      "-w",
      "-p", "tsconfig.json",
      "--outFile", TSC_TMP_FILE,
      "--diagnostics",
    ], {
      stdio: "inherit",
    }).on("error", (err) => {
      tsc = null;
      handleError(err);
    }).on("exit", (code) => {
      tsc = null;
      handleError(new Error(`tsc exited with ${code}`));
    });

    gulp.watch([
      LANGS_GLOB,
      TEMPLATES_GLOB,
      SMILESJS_GLOB,
      TSC_TMP_FILE,
    ], [name]);
  }
}

// Build legacy ES5 client for old browsers.
function buildES5() {
  const name = "es5";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient({target: "ES5", outFile: "app.es5.js"})
      .pipe(uglify())
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(JS_DIR))
  );
}

// Special task, run separately.
gulp.task("smiles", () => {
  const smileNames = fs.readdirSync("smiles");
  const smileIds = smileNames
    .filter(n => /^[a-z0-9_]+\.png$/.test(n))
    .map(n => n.slice(0, -4))
    .sort();
  assert.equal(smileIds.length * 2, smileNames.length, "smiles mismatch");
  // spritesmith requires correct sorting.
  const smilePaths = [];
  smileIds.forEach(id =>
    smilePaths.push(`smiles/${id}.png`, `smiles/${id}@2x.png`)
  );
  return gulp.src(smilePaths)
    .pipe(spritesmith({
      imgName: "_smiles.png",
      cssName: "smiles.css",
      imgPath: "/static/img/smiles.png",
      retinaSrcFilter: "smiles/*@2x.png",
      retinaImgName: "_smiles@2x.png",
      retinaImgPath: "/static/img/smiles@2x.png",
      // https://github.com/twolfson/gulp.spritesmith/issues/97
      padding: 1,
      cssOpts: {
        cssSelector: s => ".smile-" + s.name,
      },
    }))
    .pipe(gulp.dest("smiles-pp"))
    .pipe(gulpif("*.png", tap(function({ basename }) {
      // gulp-imagemin requires 240+ deps, fuck that shit.
      spawnSync("optipng", [
        "-quiet",
        "-clobber",
        "-strip", "all",
        "-out", basename.slice(1),
        basename,
      ], {cwd: "smiles-pp", stdio: "inherit"});
    })))
    .on("end", () => {
      const jsSmiles = smileIds.map(id => `"${id}"`).join(",");
      const jsModule = `
        // AUTOGENERATED, DO NOT EDIT
        export default new Set([${jsSmiles}]);
      `;
      fs.writeFileSync("smiles-pp/smiles.js", jsModule);

      const goSmiles = smileIds.map(id => `"${id}":true`).join(",");
      const goModule = `
        // AUTOGENERATED, DO NOT EDIT
        package smiles
        var Smiles = map[string]bool{${goSmiles}}
      `;
      try { fs.mkdirSync("go/src/smiles"); } catch(e) { /* skip */ }
      fs.writeFileSync("go/src/smiles/smiles.go", goModule);
    });
});

gulp.task("clean", () =>
  del(DIST_DIR)
);

// Client JS files.
buildES6();
if (!watch) buildES5();

// Third-party dependencies and loader.
createTask("loader", "loader.js", src =>
  src
    .pipe(rjsOptimize({
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
        ruhangul: "node_modules/ruhangul/index.es5",
      },
    }))
    .on("error", handleError)
    .pipe(gulpif(!watch, uglify()))
    .pipe(gulp.dest(JS_DIR))
);

// Polyfills and other deps.
createTask("polyfills", [
  "node_modules/core-js/client/core.min.js",
  "node_modules/proxy-polyfill/proxy.min.js",
  "node_modules/dom4/build/dom4.js",
  "node_modules/whatwg-fetch/fetch.js",
  "node_modules/vmsg/vmsg.wasm",
  "node_modules/wasm-polyfill.js/wasm-polyfill.js",
], src =>
  src
    .pipe(gulpif(/core\.min\.js$/, rjsOptimize({
      logLevel: 2,
      optimize: "none",
    })))
    .pipe(gulp.dest(JS_DIR))
);

// Compile Less to CSS.
createTask("css", "less/[^_]*.less", src =>
  src
    .pipe(sourcemaps.init())
    .pipe(less())
    .on("error", handleError)
    .pipe(gulpif(!watch, require("gulp-postcss")([
      // NOTE(Kagami): Takes ~1sec to just require them.
      require("autoprefixer")(),
      require("cssnano")({
        // Avoid fixing z-index which might be used in animation.
        zindex: false,
        // Avoid renaming counters which should be accessed from JS.
        reduceIdents: false,
        // Remove all comments.
        discardComments: {removeAll: true},
      }),
    ])))
    .on("error", handleError)
    .pipe(sourcemaps.write("maps"))
    .pipe(gulp.dest(CSS_DIR))
    .pipe(gulpif("**/*.css", livereload()))
, ["less/*.less", "smiles-pp/smiles*.css"]);

// Static assets.
createTask("assets", ["assets/**/*", "smiles-pp/smiles*.png"], src =>
  src
    .pipe(gulpif("smiles*.png",
      gulp.dest(IMG_DIR),
      gulp.dest(STATIC_DIR)
    ))
);

// Fonts.
createTask("fonts", "node_modules/font-awesome/fonts/fontawesome-webfont.*",
           src =>
  src
    .pipe(gulp.dest(FONTS_DIR))
);

// Kpopnet static.
gulp.task("kpopnet", () => {
  return new Promise((resolve, reject) => {
    spawn("node_modules/.bin/webpack-cli", [
      "--mode", watch ? "development" : "production",
      "--env.output", KPOPNET_DIST_DIR,
      "--env.api_prefix", KPOPNET_API_PREFIX,
      "--env.file_prefix", KPOPNET_FILE_PREFIX,
      "--config", KPOPNET_WEBPACK_CONFIG,
      "--display", "errors-only",
    ], {
      stdio: "inherit",
    }).on("error", reject)
      .on("exit", (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`webpack exited with ${code}`));
        }
      });
  });
});
if (!watch || all) {
  tasks.push("kpopnet");
}

// Build everything.
gulp.task("default", (cb) => {
  runSequence("clean", tasks, cb)
});

if (watch) {
  livereload.listen({quiet: true})
}
