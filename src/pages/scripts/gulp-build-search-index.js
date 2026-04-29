// gulp-build-search-index
// Scans the build directory and generates a search_index.js file for client-side search.
// Usage in gulpfile.mjs:
//   import buildSearchIndex from "./src/pages/scripts/gulp-build-search-index.js";
//   buildSearchIndex(gulp, path, buildDestionation);

/**
 * Registers the vf-build-search-index gulp task.
 * Scans all HTML files in buildDestionation and writes a search_index.js.
 * Elements with class="vf-search-client-side--no-index" are excluded from the index.
 * @param {object} gulp
 * @param {object} path
 * @param {string} buildDestionation
 */
module.exports = function buildSearchIndex(gulp, path, buildDestionation) {
  const fs = require("fs");
  const gutil = require("gulp-util");
  const through = require("through2");
  const stripJs = require("strip-js");
  const striptags = require("striptags");
  const HTMLParser = require("node-html-parser");

  gulp.task("vf-build-search-index", function () {
    const fileName = buildDestionation + "/search_index.js";
    const endOfLine = "\r\n";
    const pathPrefix = "/web-optimisation-framework";
    var counter = 0;
    gutil.log(gutil.colors.green("Prepping search index for " + fileName));
    var output = "let searchIndex = {\"pages\": [";

    return gulp.src([buildDestionation + "/**/*.html"])
      .pipe(through.obj(function (file, enc, cb) {
        gutil.log(gutil.colors.green("Indexing:", file.path.split(buildDestionation)[1]));

        let text = fs.readFileSync(file.path, "utf8");
        const titleMatch = text.match(/<h1 class="vf-intro__heading">(.*?)<\/h1>/i);
        let title = titleMatch ? titleMatch[1] : "";
        title = striptags(title).split("|")[0].trim(); // only keep anything before the first pipe

        var body = "";

        // Extract the full text of <main> for richer indexing
        const parsedDoc = HTMLParser.parse(text);
        const mainEl = parsedDoc.querySelector("main");
        if (mainEl) {
          // Remove nav, header, footer, and no-index elements from the extracted content
          mainEl.querySelectorAll(".vf-search-client-side--no-index, nav, header, footer").forEach(function (el) {
            el.remove();
          });
          body = stripJs(striptags(mainEl.toString()));
        }

        // Fallback to lede paragraph, then title if main is empty
        if (!body || !body.trim()) {
          const ledeMatch = text.match(/<p class="vf-lede">(.*?)<\/p>/);
          body = ledeMatch ? ledeMatch[1] : title;
        }

        body = body.replace(/&quot;/g, " ");
        body = body.replace(/class\=/g, " ");
        body = body.replace(/<body.[\s\S]*?>(.[\s\S]*?)<\/body>/gi, "$1");
        body = body.replace(/\r?\n|\r/g, " ");
        body = body.replace(/ {4}/g, " ");
        body = body.replace(/ {3}/g, " ");
        body = body.replace(/ {2}/g, " ");
        body = body.replace(/"/g, "'");
        body = body.replace(/null/g, " ");

        const normalizedTitle = title.trim();
        const normalizedBody = body.trim();

        if (!normalizedTitle || !normalizedBody) {
          gutil.log(gutil.colors.yellow("Skipping empty search entry:"), file.path.split(buildDestionation)[1]);
          cb(null, file);
          return;
        }

        output += endOfLine + "{\"id\":\"" + counter + "\", \"title\": \"" + normalizedTitle + "\", \"text\": \"" + normalizedBody + "\", \"tags\": \"\", ";
        counter = counter + 1;

        // Strip index.html to get a clean directory URL, then prepend base URL + path prefix.
        let localFilePath = file.path.split(buildDestionation)[1].replace(/index\.html$/, "");
        const fullUrl = pathPrefix + localFilePath;
        output += "\"url\": \"" + fullUrl + "\"";
        output += "},";
        cb(null, file);
      })
        .on("finish", function () {
          gutil.log(gutil.colors.green("Finished prepping search JSON"));
          fs.writeFileSync(fileName, output + endOfLine + "]};");
        })
        .on("error", function (err) {
          gutil.log(gutil.colors.red(err.message));
          process.exit(1);
        })
    );
  });

  return gulp;
};
