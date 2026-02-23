const path = require("path");
const gulp  = require('gulp');
const browserSync = require('browser-sync').create();
var   fractalBuildMode;

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Pull in optional configuration from the package.json file, a la:
const {
  componentPath,
  componentDirectories,
  buildDestionation,
} = require("@visual-framework/vf-config");

// Tasks to build/run vf-core component system
require("./node_modules/@visual-framework/vf-core/gulp-tasks/_gulp_rollup.js")(
  gulp,
  path,
  componentPath,
  componentDirectories,
  buildDestionation
);
require("./node_modules/@visual-framework/vf-extensions/gulp-tasks/_gulp_rollup.js")(
  gulp,
  path,
  componentPath,
  componentDirectories,
  buildDestionation
);

// Watch folders for changes
gulp.task("watch", function() {
  // left for convience for local watch additions
  gulp.watch(["./build/css/styles.css"], gulp.series("eleventy:reload"));
});


// Copy pages to the build directory
gulp.task('pages', function(){
  return gulp.src('./src/pages/**/*')
    .pipe(gulp.dest(buildDestionation));

});

// Serve locally
gulp.task('browser-sync', function(done) {
  browserSync.init({
    server: {
          baseDir: './build',
          index: buildDestionation+'/index.html'
        }
  });
  done();
});

gulp.task('browser-reload', function(done) {
  browserSync.reload();
  done();
});


// Let's build this sucker.
gulp.task('build', gulp.series(
  'vf-clean',
  gulp.parallel('pages','vf-css','vf-scripts','vf-component-assets'),
  "vf-css:production", //optimise, prefix css
  "fractal:build",
  "fractal",
  "eleventy:init",
  "eleventy:build"
));

// Build and watch things during dev
gulp.task('dev', gulp.series(
  'vf-clean',
  gulp.parallel('pages','vf-css','vf-scripts','vf-component-assets'),
  "fractal:development",
  "fractal",
  "eleventy:init",
  "eleventy:develop",
  gulp.parallel("watch", "vf-watch")
));
