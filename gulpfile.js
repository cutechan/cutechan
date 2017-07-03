"use strict";

const path = require("path");
const del = require("del");
const merge = require("merge-stream");
const stripAnsi = require("strip-ansi");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const uglifyes = require("uglify-es");
const gulp = require("gulp");
const gutil = require("gulp-util");
const concat = require("gulp-concat");
const gulpif = require("gulp-if");
const tap = require("gulp-tap");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const rjsOptimize = require("gulp-requirejs-optimize");
const less = require("gulp-less");
const postcss = require("gulp-postcss");
const rename = require("gulp-rename");
const composer = require("gulp-uglify/composer");
const notify = require("gulp-notify");
const runSequence = require("run-sequence");

const TYPESCRIPT_GLOB = "client/**/*.ts";
const TEMPLATES_GLOB = "go/src/meguca/templates/mustache/**/*.mustache";

const DIST_DIR = "dist";
const STATIC_DIR = path.join(DIST_DIR, "static");
const JS_DIR = path.join(STATIC_DIR, "js");
const CSS_DIR = path.join(STATIC_DIR, "css");
const FONTS_DIR = path.join(STATIC_DIR, "fonts");

// Keep script alive and rebuild on file changes.
// Triggered with the `-w` flag.
const watch = gutil.env.w;

// Dependency tasks for the default tasks.
const tasks = [];

// Notify about errors.
const notifyError = notify.onError({
  title: "<%= error.name %>",
  message: "<%= options.stripAnsi(error.message) %>",
  templateOptions: {stripAnsi},
});

// ES6 minification.
const minify = composer(uglifyes, console);

// Simply log the error on continuos builds, but fail the build and exit
// with an error status, if failing a one-time build. This way we can
// use failure to build the client to not pass Travis CL tests.
function handleError(err) {
  if (watch) {
    notifyError(err);
    this.emit("end");
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

function templates() {
  return gulp.src([TEMPLATES_GLOB])
    .pipe(sourcemaps.init())
    .pipe(tap(function(file) {
      const name = JSON.stringify(path.basename(file.path, ".mustache"));
      const template = JSON.stringify(file.contents.toString());
      file.contents = new Buffer(`CUTE_TEMPLATES[${name}] = ${template};`);
    }))
    .pipe(concat("templates.js"))
    .pipe(tap(function(file) {
      file.contents = Buffer.concat([
        new Buffer("var CUTE_TEMPLATES = {};\n"),
        file.contents,
      ]);
    }));
}

function typescript(opts) {
  const project = ts.createProject("client/tsconfig.json", opts);
  return gulp.src([TYPESCRIPT_GLOB])
    .pipe(sourcemaps.init())
    .pipe(project(ts.reporter.nullReporter()))
    .on("error", handleError);
}

function buildClient(tsOpts) {
  return merge(templates(), typescript(tsOpts))
    .on("error", () => {})
    .pipe(concat(tsOpts.outFile));
}

// Builds the client files of the appropriate ECMAScript version.
function buildES6() {
  const name = "es6";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient({target: "ES6", outFile: "app.js"})
      .pipe(gulpif(!watch, minify()))
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(JS_DIR)));

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    gulp.watch([TEMPLATES_GLOB, TYPESCRIPT_GLOB], [name])
  }
}

// Build legacy ES5 client for old browsers.
function buildES5() {
  const name = "es5";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient({
      target: "ES5",
      lib: ["DOM", "ES6", "DOM.Iterable", "ScriptHost"],
      downlevelIteration: true,
      outFile: "app.es5.js"
    })
      .pipe(minify())
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(JS_DIR))
  );
}

gulp.task("clean", () => {
  return del(DIST_DIR);
});

// Client JS files.
buildES6();
buildES5();

// Third-party dependencies and loader.
createTask("deps", "client/loader.js", src =>
  src
    .pipe(rjsOptimize({
      optimize: "none",
      skipModuleInsertion: true,
      paths: {
        almond: "../node_modules/almond/almond",
        mustache: "../node_modules/mustache/mustache",
        react: "../node_modules/react/dist/react",
        "react-dom": "../node_modules/react-dom/dist/react-dom",
      },
      deps: ["almond", "mustache", "react-dom"],
      out: "deps.js",
    }))
    .pipe(gulpif(!watch, minify()))
    .pipe(gulp.dest(JS_DIR))
);

// Polyfills.
createTask("polyfills", [
  "node_modules/core-js/client/core.min.js",
  "node_modules/proxy-polyfill/proxy.min.js",
  "node_modules/dom4/build/dom4.js",
  "node_modules/whatwg-fetch/fetch.js ",
], src =>
  src
    .pipe(gulp.dest(JS_DIR))
);

// Compile Less to CSS.
createTask("css", ["less/*.less", "!less/*.mix.less"], src =>
  src
    .pipe(sourcemaps.init())
    .pipe(less())
    .on("error", handleError)
    .pipe(postcss([
      autoprefixer(),
      cssnano({discardComments: {removeAll: true}}),
    ]))
    .pipe(sourcemaps.write("maps"))
    .pipe(gulp.dest(CSS_DIR))
, "less/*.less");

// Static assets.
createTask("assets", "assets/**/*", src =>
  src
    .pipe(gulp.dest(STATIC_DIR))
);

// Fonts.
createTask("fonts", "node_modules/font-awesome/fonts/fontawesome-webfont.*",
           src =>
  src
    .pipe(gulp.dest(FONTS_DIR))
);

// Build everything.
gulp.task("default", runSequence("clean", tasks));
