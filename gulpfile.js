var gulp = require("gulp");
var istanbul = require('gulp-istanbul');
 var fs = require('fs');
 var walkSync = function(dir, filelist) {
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + file).isDirectory()) {
      filelist = walkSync(dir + file + '/', filelist);
    }
    else {
		console.log(dir + file );
      filelist.push(dir + file );
    }
  });
  return filelist;
};    

gulp.task('test', function() {
walkSync("./api/");
});

gulp.task( 'default', [ 'test' ] );

