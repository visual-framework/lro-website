const { DateTime } = require('luxon');
const _ = require('lodash');
const Path = require('path');
const yaml = require("js-yaml");
const helper = require("@11ty/eleventy-upgrade-help");
const moment = require("moment");
const slugify = require("slugify");

const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");

module.exports = function (config) {


  config.addPlugin(eleventyNavigationPlugin);

  // Add in tags, filters useful for Visual Framework installs
  // (fractal's render tag, codeblock, markdown, etc)
  // and common configuration
  const vfEleventyExtension = require("@visual-framework/vf-extensions\/11ty");
  config.addPlugin(helper);
  config.addPlugin(vfEleventyExtension);

  // BroswerSync options
  config.setBrowserSyncConfig({ open: true });

  // Filters
  // https://www.11ty.io/docs/filters/
  // -----

  // {{ "myContent" | sampleFilter }}
  // config.addFilter("sampleFilter", function(value) {
  //   return 'ddd' + value;
  // });

  // Add any utiliuty filters
  config.addFilter("dateDisplay", (dateObj, format = "LLL d, y") => {
    return DateTime.fromJSDate(dateObj, {
      zone: "utc"
    }).toFormat(format);
  });

  config.addFilter("shortMonth", (yearMonthString) => {
    const [year, month] = yearMonthString.split("/");
    const monthsArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return monthsArray[month - 1] + " " + year;
  });

  // receive format of `2015-10-08T15:30:00` and make it pretty with Moment.js
  config.addFilter("dateMoment", (time, format = "D MMMM YYYY, HH:mm") => {
    time = time.replace('T', ' '); // no need for T in timestamp
    time = time || new Date();
    if (format == 'unix') {
      return moment(time).format('X'); // time in seconds
    } else {
      return moment(time).format(format);
    }
  });
  config.addFilter("dateMoment", (time, format = "D MMMM YYYY, HH:mm") => {
    time = time.replace('T', ' '); // no need for T in timestamp
    time = time || new Date();
    if (format == 'unix') {
      return moment(time).format('X'); // time in seconds
    } else {
      return moment(time).format(format);
    }
  });


  // Add utility for flatten and create array required for vf-navigation from eleventy nav plugin data
  config.addFilter("eleventyNavigationCollectionToVFNavigationData", (eleventyNavigationCollection) => {
    return eleventyNavigationCollection.flat();
  });

  config.addPassthroughCopy("./src/site/**/*.js");

  // pass some assets right through
  config.addPassthroughCopy("./src/site/images");

  // use the .yml file associated with the .njk if available
  config.addDataExtension("yml", contents => yaml.safeLoad(contents));

  return {
    dir: {
      input: "src/pages",
      output: "build",
      data: "_data"
    },
    templateFormats: [
      "njk", "md", // note that .md files will also be parsed with njk processor
      "css" // passthrough file copying for static assets
    ],
    htmlTemplateEngine: ["njk", "md"],
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true,
    pathPrefix: "/lro-guidelines" // if your site is deployed to a sub-url, otherwise comment out
  };
};
