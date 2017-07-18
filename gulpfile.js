'use strict';

const gulp = require('gulp'),
  nodemon = require('gulp-nodemon'),
  sass = require('gulp-sass'),
  sassImporter = require('sass-module-importer'),
  rename = require('gulp-rename'),
  del = require('del'),
  webpack = require('webpack'),
  through = require('through2'),
  scssToJson = require('scss-to-json'),
  webpackConfig = require('./webpack.config');

const paths = {
  js: 'src/js/**/*.js',
  sass: 'src/sass/**/*.scss',
};

gulp.task('variables', () => {
  return gulp.src('src/sass/variables.scss', { read: false })
    .pipe(through.obj((file, enc, cb) => {
      const variables = scssToJson(file.path);
      file.contents = new Buffer(JSON.stringify(variables));
      cb(null, file);
    }))
    .pipe(rename('variables.json'))
    .pipe(gulp.dest('src/shared'));
});

const compiler = webpack(webpackConfig);
const webpackCompileHandler = (cb, watching) => {
  return (err, stats) => {
    console.log(`Webpack: ${stats}`);
    if (err) return cb(err);
    if (!watching) cb();
  };
};

gulp.task('compile-js', (cb) => {
  if (process.env.NODE_ENV === 'development') {
    return compiler.watch({
      ignored: /node_modules/,
    }, webpackCompileHandler(cb, true));
  }

  compiler.run(webpackCompileHandler(cb));
});

gulp.task('build-js', gulp.series('variables', 'compile-js'));

gulp.task('build-css', () => {
  return gulp.src(paths.sass, { sourcemaps: true })
    .pipe(sass({ importer: sassImporter() }).on('error', sass.logError))
    .pipe(gulp.dest('public/css'));
});

gulp.task('clean-css', () => del(['public/css']));
gulp.task('clean', gulp.series('clean-css'));

gulp.task('watch', () => {
  // Webpack has its own watch
  gulp.watch(paths.sass, gulp.series('clean-css', 'build-css'));
});

const nodemonConfig = {
  script: 'server.js',
  ext: 'js',
  watch: ['lib'],
  env: { NODE_ENV: 'development' },
  nodeArgs: [],
};

gulp.task('serve', () => {
  nodemon(nodemonConfig);
});

gulp.task('build', gulp.series('clean', gulp.parallel('build-js', 'build-css')));
gulp.task('default', gulp.parallel('build', 'serve', 'watch'));
