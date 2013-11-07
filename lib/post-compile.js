;(function() {
  'use strict';

  /** Load Node.js modules */
  var fs = require('fs'),
      vm = require('vm');

  /** The minimal license/copyright template */
  var licenseTemplate = [
    '/**',
    ' * @license',
    ' * Lo-Dash <%= VERSION %> lodash.com/license | Underscore.js 1.5.2 underscorejs.org/LICENSE',
    ' */'
  ].join('\n');

  /*--------------------------------------------------------------------------*/

  /**
   * Post-process a given minified Lo-Dash `source`, preparing it for
   * deployment.
   *
   * @param {string} source The source to process.
   * @returns {string} Returns the processed source.
   */
  function postprocess(source) {
    // correct overly aggressive Closure Compiler advanced optimization
    source = source
      .replace(/\b(prototype\s*=\s*\{\s*valueOf\s*:\s*1)(\s*})/, '$1,y:1$2')
      .replace(/\b(document[^&]+&&)\s*(?:\w+|!\d)/, '$1!({toString:0}+"")')
      .replace(/"\t"/g, '"\\t"')
      .replace(/"[^"]*?\\f[^"]*?"/g,
        '" \\t\\x0B\\f\\xa0\\ufeff' +
        '\\n\\r\\u2028\\u2029' +
        '\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000"'
      );

    // replace `!0` and `!1` with `true` and `false`
    source = source.replace(/(.)(\![01])\b/g, function(match, chr, exp) {
      return chr + (/\w/.test(chr) ? ' ' : '') + (exp == '!0');
    });

    // flip `typeof` expressions to help optimize Safari and
    // correct the AMD module definition for AMD build optimizers
    // (e.g. from `"number" == typeof x` to `typeof x == "number")
    source = source.replace(/(\w)?("[^"]+")\s*([!=]=)\s*(typeof(?:\s*\([^)]+\)|\s+[.\w]+(?!\[)))/g, function(match, other, type, equality, exp) {
      return (other ? other + ' ' : '') + exp + equality + type;
    });

    // add a space so `define` is detected by the Dojo builder
    source = source.replace(/(.)(define\()/, function(match, prelude, define) {
      return prelude + (/^\S/.test(prelude) ? ' ' : '') +  define;
    });

    // add trailing semicolon
    if (source) {
      source = source.replace(/[\s;]*?(\s*\/\/.*\s*|\s*\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/\s*)*$/, ';$1');
    }
    // exit early if version snippet isn't found
    var snippet = /VERSION\s*[=:]\s*([\'"])(.*?)\1/.exec(source);
    if (!snippet) {
      return source;
    }
    // remove copyright header
    source = source.replace(/^\/\**[\s\S]+?\*\/\n/, '');

    // add new copyright header
    var version = snippet[2];
    source = licenseTemplate.replace('<%= VERSION %>', version) + '\n;' + source;

    return source;
  }

  /*--------------------------------------------------------------------------*/

  // expose `postprocess`
  if (module != require.main) {
    module.exports = postprocess;
  }
  else {
    // read the Lo-Dash source file from the first argument if the script
    // was invoked directly (e.g. `node post-compile.js source.js`) and write to
    // the same file
    (function() {
      var options = process.argv;
      if (options.length < 3) {
        return;
      }
      var filePath = options[options.length - 1],
          source = fs.readFileSync(filePath, 'utf8');

      fs.writeFileSync(filePath, postprocess(source), 'utf8');
    }());
  }
}());
