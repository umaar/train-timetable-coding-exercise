var gulp = require('gulp');
var webserver = require('gulp-webserver');

gulp.task('default',['webserver']);
 
gulp.task('webserver', function() {
  gulp.src('src')
    .pipe(webserver({
      livereload: true,
      directoryListing: {
    	enable:true,
    	path: 'src'
	  },
      open: true,
    }));
});
