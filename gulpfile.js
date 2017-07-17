'use strict';

const gulp = require('gulp'),
  babel = require('gulp-babel'),
  nodemon = require('gulp-nodemon'),
  sass = require('gulp-sass'),
  rename = require('gulp-rename'),
  del = require('del'),
  webpack = require('webpack'),
  webpackStream = require('webpack-stream'),
  named = require('vinyl-named'),
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
    .pipe(gulp.dest('src/shared'))
});

gulp.task('compile-js', () => {
  return gulp.src(paths.js)
    .pipe(named())
    .pipe(webpackStream(webpackConfig, webpack))
    .pipe(gulp.dest('public/js'));
});

gulp.task('build-js', gulp.series('variables', 'compile-js'));

gulp.task('build-css', () => {
  return gulp.src(paths.sass, { sourcemaps: true })
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('public/css'));
});

gulp.task('clean-js', () => del(['public/js']));
gulp.task('clean-css', () => del(['public/css']));
gulp.task('clean', gulp.parallel('clean-js', 'clean-css'));

gulp.task('watch', () => {
  gulp.watch(paths.js, gulp.series('clean-js', 'build-js'));
  gulp.watch(paths.sass, gulp.series('clean-css', 'build-css'));
});

const nodemonConfig = {
  script: 'server.js',
  ext: 'js',
  watch: ['lib'],
  env: { NODE_ENV: 'development' },
  nodeArgs: []
};

gulp.task('serve-docker', () => {
  nodemon(Object.assign({ legacyWatch: true }, nodemonConfig));
});

gulp.task('build', gulp.series('clean', gulp.parallel('build-js', 'build-css')));
gulp.task('docker', gulp.parallel('build', 'serve-docker', 'watch'));
