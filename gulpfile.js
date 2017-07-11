var gulp = require("gulp");
var eslint   = require('gulp-eslint');
var reporter = require('eslint-html-reporter');
var path     = require('path');
var fs       = require('fs');
 

  
  gulp.task('test', function() {
return gulp.src(['./api/**/*.js'])
  .pipe(eslint())
  .pipe(eslint.format(reporter, function(results) {
      fs.writeFileSync(path.join(__dirname, 'report-results.html'), results);
    })
  );
});
  gulp.task( 'default', [ 'test' ] );