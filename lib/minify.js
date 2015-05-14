'use strict';

/** Used to specify the default minifer modes. */
var DEFAULT_MODES = ['simple', 'advanced', 'hybrid'];

/** The minimum version of Java required for the Closure Compiler. */
var JAVA_MIN_VERSION = '1.7.0';

/** Load Node.js modules. */
var spawn = require('child_process').spawn,
    zlib = require('zlib');

/** Load other modules. */
var _ = require('lodash-compat'),
    preprocess = require('./pre-compile.js'),
    postprocess = require('./post-compile.js'),
    util = require('./util.js');

/** Module references. */
var fs = util.fs,
    path = util.path;

/** Native method shortcut. */
var push = Array.prototype.push;

/** Used to extract version numbers. */
var reDigits = /^[.\d]+/;

/** The Closure Compiler optimization modes. */
var optimizationModes = {
  'simple': 'simple_optimizations',
  'advanced': 'advanced_optimizations'
};

/*----------------------------------------------------------------------------*/

/**
 * Minifies a given lodash `source` and invokes the `options.onComplete`
 * callback when finished. The `onComplete` callback is invoked with one
 * argument; (outputSource).
 *
 * @param {string|string[]} [source=''] The source to minify or array of commands.
 *  -o, --output - Write output to a given path/filename.
 *  -s, --silent - Skip status updates normally logged to the console.
 *  -t, --template - Applies template specific minifier options.
 *
 * @param {Object} [options={}] The options object.
 * @param {string} [options.outputPath] Write output to a given path/filename.
 * @param {boolean} [options.isSilent] Skip status updates normally logged to the console.
 * @param {boolean} [options.isTemplate] Applies template specific minifier options.
 * @param {Function} [options.onComplete] The function called once minification has finished.
 */
function minify(source, options) {
  source || (source = '');
  options = _.cloneDeep(options);

  // Convert commands to an options object.
  if (_.isArray(source)) {
    options = source;

    // Used to specify the source map URL.
    var sourceMapURL;

    // Used to report invalid command-line arguments.
    var invalidArgs = _.reject(options, function(value, index, options) {
      if (/^(?:-o|--output)$/.test(options[index - 1]) ||
          /^modes=.*$/.test(value)) {
        return true;
      }
      var result = _.includes([
        '-m', '--source-map',
        '-o', '--output',
        '-s', '--silent',
        '-t', '--template'
      ], value);

      if (!result && /^(?:-m|--source-map)$/.test(options[index - 1])) {
        sourceMapURL = value;
        return true;
      }
      return result;
    });

    // Report invalid arguments.
    if (!_.isEmpty(invalidArgs)) {
      console.log('\nInvalid argument' + (_.size(invalidArgs) > 1 ? 's' : '') + ' passed:', invalidArgs.join(', '));
      return;
    }
    var filePath = path.normalize(_.last(options)),
        outputPath = path.join(path.dirname(filePath), path.basename(filePath, '.js') + '.min.js');

    outputPath = _.reduce(options, function(result, value, index) {
      if (/-o|--output/.test(value)) {
        result = path.normalize(options[index + 1]);
        var dirname = path.dirname(result);
        fs.mkdirpSync(dirname);
        result = path.join(fs.realpathSync(dirname), path.basename(result));
      }
      return result;
    }, outputPath);

    options = {
      'filePath': filePath,
      'isMapped': getOption(options, '-m') || getOption(options, '--source-map'),
      'isSilent': getOption(options, '-s') || getOption(options, '--silent'),
      'isTemplate': getOption(options, '-t') || getOption(options, '--template'),
      'modes': getOption(options, 'modes', DEFAULT_MODES),
      'outputPath': outputPath,
      'sourceMapURL': sourceMapURL
    };

    source = fs.readFileSync(filePath, 'utf8');
  }
  else {
    options.filePath = path.normalize(options.filePath);
    options.modes = _.result(options, 'modes', DEFAULT_MODES);
    options.outputPath = path.normalize(options.outputPath);
  }
  if (options.isMapped) {
    _.pull(options.modes, 'advanced', 'hybrid');
  }
  if (options.isTemplate) {
    _.pull(options.modes, 'advanced');
  }
  new Minify(source, options);
}

/**
 * The Minify constructor used to keep state of each `minify` invocation.
 *
 * @private
 * @constructor
 * @param {string} source The source to minify.
 * @param {Object} options The options object.
 * @param {string} [options.outputPath=''] Write output to a given path/filename.
 * @param {boolean} [options.isMapped] Specify creating a source map for the minified source.
 * @param {boolean} [options.isSilent] Skip status updates normally logged to the console.
 * @param {boolean} [options.isTemplate] Applies template specific minifier options.
 * @param {Function} [options.onComplete] The function called once minification has finished.
 */
function Minify(source, options) {
  // Juggle arguments.
  if (_.isObject(source)) {
    options = source;
    source = options.source || '';
  }
  var modes = options.modes;
  source = preprocess(source, options);

  this.compiled = { 'simple': {}, 'advanced': {} };
  this.hybrid = { 'simple': {}, 'advanced': {} };
  this.uglified = {};

  this.filePath = options.filePath;
  this.isMapped = !!options.isMapped;
  this.isSilent = !!options.isSilent;
  this.isTemplate = !!options.isTemplate;
  this.modes = modes;
  this.outputPath = options.outputPath;
  this.source = source;
  this.sourceMapURL = options.sourceMapURL;

  this.onComplete = options.onComplete || function(data) {
    var outputPath = this.outputPath,
        sourceMap = data.sourceMap;

    fs.writeFileSync(outputPath, data.source, 'utf8');
    if (sourceMap) {
      fs.writeFileSync(getMapPath(outputPath), sourceMap, 'utf8');
    }
  };

  // Begin the minification process.
  if (this.isMapped) {
    uglify.call(this, source, 'UglifyJS', onUglify.bind(this));
  } else if (_.includes(modes, 'simple')) {
    closureCompiler.call(this, source, 'simple', onClosureSimpleCompile.bind(this));
  } else if (_.includes(modes, 'advanced')) {
    onClosureSimpleGzip.call(this);
  } else {
    onClosureAdvancedGzip.call(this);
  }
}

/*----------------------------------------------------------------------------*/

/**
 * Asynchronously checks if Java 1.7 is installed. The callback is invoked
 * with one argument; (success).
 *
 * @private
 * @type Function
 * @param {Function} callback The function called once the status is resolved.
 */
var checkJava = (function() {
  var result;
  return function(callback) {
    if (result != null) {
      _.defer(callback, result);
      return;
    }
    var java = spawn('java', ['-version']);

    java.stderr.on('data', function(data) {
      java.stderr.removeAllListeners('data');

      var version = _.result(/(?:java|openjdk) version "(.+)"/.exec(data.toString()), 1, '');
      result = compareVersion(version, JAVA_MIN_VERSION) > -1;
      if (result) {
        callback(result);
      } else {
        java.emit('error');
      }
    });

    java.on('error', function() {
      result = false;
      callback(result);
    });
  };
}());

/**
 * Compares two version strings to determine if the first is greater than,
 * equal to, or less then the second.
 *
 * @private
 * @param {string} [version=''] The version string to compare to `other`.
 * @param {string} [other=''] The version string to compare to `version`.
 * @returns {number} Returns `1` if greater then, `0` if equal to, or `-1` if
 *  less than the second version string.
 */
function compareVersion(version, other) {
  version = splitVersion(version);
  other = splitVersion(other);

  var index = -1,
      verLength = version.length,
      othLength = other.length,
      maxLength = Math.max(verLength, othLength),
      diff = Math.abs(verLength - othLength);

  push.apply(verLength == maxLength ? other : version, _.range(0, diff, 0));
  while (++index < maxLength) {
    var verValue = version[index],
        othValue = other[index];

    if (verValue > othValue) {
      return 1;
    }
    if (verValue < othValue) {
      return -1;
    }
  }
  return 0;
}

/**
 * Resolves the source map path from the given output path.
 *
 * @private
 * @param {string} outputPath The output path.
 * @returns {string} Returns the source map path.
 */
function getMapPath(outputPath) {
  return path.join(path.dirname(outputPath), path.basename(outputPath, '.js') + '.map');
}

/**
 * Gets the value of a given name from the `options` array. If no value is
 * available the `defaultValue` is returned.
 *
 * @private
 * @param {Array} options The options array to inspect.
 * @param {string} name The name of the option.
 * @param {*} defaultValue The default option value.
 * @returns {*} Returns the option value.
 */
function getOption(options, name, defaultValue) {
  var isArr = _.isArray(defaultValue);
  return _.reduce(options, function(result, value) {
    if (isArr) {
      value = optionToArray(name, value);
      return _.isEmpty(value) ? result : value;
    }
    value = optionToValue(name, value);
    return value == null ? result : value;
  }, defaultValue);
}

/**
 * Compress a source with Gzip. Yields the gzip buffer and any exceptions
 * encountered to a callback function.
 *
 * @private
 * @param {string} source The source to gzip.
 * @param {Function} callback The function called once the process has completed.
 * @param {Buffer} result The gzipped source buffer.
 */
function gzip(source, callback) {
  return _.size(zlib.gzip) > 2
    ? zlib.gzip(source, { 'level': zlib.Z_BEST_COMPRESSION } , callback)
    : zlib.gzip(source, callback);
}

/**
 * Converts a comma separated option value into an array.
 *
 * @private
 * @param {string} name The name of the option to inspect.
 * @param {string} string The options string.
 * @returns {Array} Returns the new converted array.
 */
function optionToArray(name, string) {
  return _.compact(_.invoke((optionToValue(name, string) || '').split(/, */), 'trim'));
}

/**
 * Extracts the option value from an option string.
 *
 * @private
 * @param {string} name The name of the option to inspect.
 * @param {string} string The options string.
 * @returns {string|undefined} Returns the option value, else `undefined`.
 */
function optionToValue(name, string) {
  var result = (result = string.match(RegExp('^' + name + '(?:=([\\s\\S]+))?$'))) && (result[1] ? result[1].trim() : true);
  if (result === 'false') {
    return false;
  }
  return result || undefined;
}

/**
 * Splits a version string by its decimal points into its numeric components.
 *
 * @private
 * @param {string} [version=''] The version string to split.
 * @returns {number[]} Returns the array of numeric components.
 */
function splitVersion(version) {
  if (version == null) {
    return [];
  }
  var result = String(version).match(reDigits);
  return result ? _.map(result[0].split('.'), Number) : [];
}

/*----------------------------------------------------------------------------*/

/**
 * Compress a source using the Closure Compiler. Yields the minified result
 * and any exceptions encountered to a callback function.
 *
 * @private
 * @param {string} source The JavaScript source to minify.
 * @param {string} mode The optimization mode.
 * @param {Function} callback The function called once the process has completed.
 */
function closureCompiler(source, mode, callback) {
  var compiler = require('closure-compiler'),
      isSilent = this.isSilent,
      modes = this.modes,
      outputPath = this.outputPath;

  var options = {
    'charset': this.isTemplate ? 'utf-8': 'ascii',
    'compilation_level': optimizationModes[mode],
    'warning_level': 'quiet'
  };

  checkJava(function(success) {
    // Skip using the Closure Compiler if Java is not installed.
    if (!success) {
      if (!isSilent) {
        console.warn('The Closure Compiler requires Java %s. Skipping...', JAVA_MIN_VERSION);
      }
      _.pull(modes, 'advanced', 'hybrid');
      callback();
      return;
    }
    // Remove the copyright header to make other modifications easier.
    var license = _.result(/^(?:\s*\/\/.*|\s*\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/)*\s*/.exec(source), 0, '');
    source = source.replace(license, '');

    var hasIIFE = /^;?\(function[^{]+{/.test(source),
        isStrict = /^;?\(function[^{]+{\s*["']use strict["']/.test(source);

    // To avoid stripping the IIFE, convert it to a function call.
    if (hasIIFE) {
      source = source
        .replace(/\(function/, '__iife__$&')
        .replace(/\.call\(this\)\)([\s;]*(?:\n\/\/.+)?)$/, ', this)$1');
    }
    if (!isSilent) {
      console.log('Compressing %s using the Closure Compiler (%s)...', path.basename(outputPath, '.js'), mode);
    }
    compiler.compile(source, options, function(error, output) {
      if (error) {
        callback(error);
        return;
      }
      // Restore IIFE and move exposed vars inside the IIFE.
      if (hasIIFE) {
        output = output
          .replace(/\b__iife__\b/, '')
          .replace(/,\s*this\)([\s;]*(?:\n\/\/.+)?)$/, '.call(this))$1')
          .replace(/^((?:var (?:[$\w]+=(?:!0|!1|null)[,;])+)?)([\s\S]*?function[^{]+{)/, '$2$1');
      }
      // Inject "use strict" directive.
      if (isStrict) {
        output = output.replace(/^[\s\S]*?function[^{]+{/, '$&"use strict";');
      }
      // Restore copyright header.
      if (license) {
        output = license + output;
      }
      callback(error, output);
    });
  });
}

/**
 * Compress a source using UglifyJS. Yields the minified result and any
 * exceptions encountered to a callback function.
 *
 * @private
 * @param {string} source The JavaScript source to minify.
 * @param {string} label The label to log.
 * @param {Function} callback The function called once the process has completed.
 */
function uglify(source, label, callback) {
  var uglifyJS = require('uglify-js'),
      sourceMapURL = this.isMapped && (this.sourceMapURL || path.basename(getMapPath(this.outputPath)));

  if (!this.isSilent) {
    console.log('Compressing %s using %s...', path.basename(this.outputPath, '.js'), label);
  }
  try {
    var result = uglifyJS.minify(source, {
      'fromString': true,
      'outSourceMap': sourceMapURL,
      'compress': {
        'comparisons': false,
        'keep_fargs': true,
        'pure_getters': true,
        'unsafe': true,
        'unsafe_comps': true,
        'warnings': false
      },
      'mangle': {
        'except': ['define']
      },
      'output': _.assign({
        'ascii_only': !this.isTemplate,
        'max_line_len': 500
      }, sourceMapURL ? {} : {
        'comments': /^!|@cc_on|@license|@preserve/i
      })
    });
  } catch(e) {
    var error = e;
    result = {};
  }
  result.map = !sourceMapURL ? null : JSON.stringify(_.assign(JSON.parse(result.map), {
    'file': path.basename(this.outputPath),
    'sources': [path.basename(this.filePath)]
  }));

  _.defer(callback, error, result.code, result.map);
}

/*----------------------------------------------------------------------------*/

/**
 * The Closure Compiler callback for simple optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {string} result The minified source.
 */
function onClosureSimpleCompile(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    result = postprocess(result);
    this.compiled.simple.source = result;
    gzip(result, onClosureSimpleGzip.bind(this));
  }
  else {
    onClosureSimpleGzip.call(this);
  }
}

/**
 * The Closure Compiler `gzip` callback for simple optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {Buffer} result The gzipped source buffer.
 */
function onClosureSimpleGzip(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    if (!this.isSilent) {
      console.log('Done. Size: %d bytes.', _.size(result));
    }
    this.compiled.simple.gzip = result;
  }
  if (_.includes(this.modes, 'advanced')) {
    closureCompiler.call(this, this.source, 'advanced', onClosureAdvancedCompile.bind(this));
  } else {
    onClosureAdvancedGzip.call(this);
  }
}

/**
 * The Closure Compiler callback for advanced optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {string} result The minified source.
 */
function onClosureAdvancedCompile(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    result = postprocess(result);
    this.compiled.advanced.source = result;
    gzip(result, onClosureAdvancedGzip.bind(this));
  }
  else {
    onClosureAdvancedGzip.call(this);
  }
}

/**
 * The Closure Compiler `gzip` callback for advanced optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {Buffer} result The gzipped source buffer.
 */
function onClosureAdvancedGzip(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    if (!this.isSilent) {
      console.log('Done. Size: %d bytes.', _.size(result));
    }
    this.compiled.advanced.gzip = result;
  }
  uglify.call(this, this.source, 'UglifyJS', onUglify.bind(this));
}

/**
 * The UglifyJS callback.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {string} result The minified source.
 * @param {string} map The source map output.
 */
function onUglify(error, result, map) {
  if (error) {
    throw error;
  }
  result = postprocess(result, !!map);
  _.assign(this.uglified, { 'source': result, 'sourceMap': map });
  gzip(result, onUglifyGzip.bind(this));
}

/**
 * The UglifyJS `gzip` callback.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {Buffer} result The gzipped source buffer.
 */
function onUglifyGzip(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    if (!this.isSilent) {
      console.log('Done. Size: %d bytes.', _.size(result));
    }
    this.uglified.gzip = result;
  }
  // Minify the already Closure Compiler simple optimized source using UglifyJS.
  var modes = this.modes;
  if (_.includes(modes, 'hybrid')) {
    if (_.includes(modes, 'simple')) {
      uglify.call(this, this.compiled.simple.source, 'hybrid (simple)', onSimpleHybrid.bind(this));
    } else if (_.includes(modes, 'advanced')) {
      onSimpleHybridGzip.call(this);
    }
  } else {
    onComplete.call(this);
  }
}

/**
 * The hybrid callback for simple optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {string} result The minified source.
 */
function onSimpleHybrid(error, result) {
  if (error) {
    throw error;
  }
  result = postprocess(result);
  this.hybrid.simple.source = result;
  gzip(result, onSimpleHybridGzip.bind(this));
}

/**
 * The hybrid `gzip` callback for simple optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {Buffer} result The gzipped source buffer.
 */
function onSimpleHybridGzip(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    if (!this.isSilent) {
      console.log('Done. Size: %d bytes.', _.size(result));
    }
    this.hybrid.simple.gzip = result;
  }
  // Minify the already Closure Compiler advance optimized source using UglifyJS.
  if (_.includes(this.modes, 'advanced')) {
    uglify.call(this, this.compiled.advanced.source, 'hybrid (advanced)', onAdvancedHybrid.bind(this));
  } else {
    onComplete.call(this);
  }
}

/**
 * The hybrid callback for advanced optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {string} result The minified source.
 */
function onAdvancedHybrid(error, result) {
  if (error) {
    throw error;
  }
  result = postprocess(result);
  this.hybrid.advanced.source = result;
  gzip(result, onAdvancedHybridGzip.bind(this));
}

/**
 * The hybrid `gzip` callback for advanced optimizations.
 *
 * @private
 * @param {Object} [error] The error object.
 * @param {Buffer} result The gzipped source buffer.
 */
function onAdvancedHybridGzip(error, result) {
  if (error) {
    throw error;
  }
  if (result != null) {
    if (!this.isSilent) {
      console.log('Done. Size: %d bytes.', _.size(result));
    }
    this.hybrid.advanced.gzip = result;
  }
  // Finish by choosing the smallest compressed file.
  onComplete.call(this);
}

/**
 * The callback executed after the source is minified and gzipped.
 *
 * @private
 */
function onComplete() {
  var objects = [
    this.compiled.simple,
    this.compiled.advanced,
    this.uglified,
    this.hybrid.simple,
    this.hybrid.advanced
  ];

  var gzips = _.compact(_.pluck(objects, 'gzip'));

  // Select the smallest gzipped file and use its minified counterpart as the
  // official minified release (ties go to the Closure Compiler).
  var min = _.size(_.min(gzips, 'length'));

  // Pass the minified source to the "onComplete" callback.
  _.each(objects, function(data) {
    if (_.size(data.gzip) == min) {
      data.outputPath = this.outputPath;
      this.onComplete(data);
      return false;
    }
  }, this);
}

/*----------------------------------------------------------------------------*/

// Export `minify`.
if (module != require.main) {
  module.exports = minify;
}
// Read the lodash source file from the first argument if the script was invoked
// by the command-line (e.g. `node minify.js source.js`) and write to `<filename>.min.js`.
else if (_.size(process.argv) > 2) {
  minify(process.argv.slice(2));
}
