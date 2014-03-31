;(function() {
  'use strict';

  /** Load Node.js modules */
  var spawn = require('child_process').spawn,
      zlib = require('zlib');

  /** Load other modules */
  var _ = require('lodash/lodash.js'),
      preprocess = require('./pre-compile.js'),
      postprocess = require('./post-compile.js'),
      util = require('./util.js');

  /** Module shortcuts */
  var fs = util.fs,
      path = util.path;

  /** Used to detect the Node.js executable in command-line arguments */
  var reNode = RegExp('(?:^|' + path.sepEscaped + ')node(?:\\.exe)?$', 'i');

  /** The Closure Compiler optimization modes */
  var optimizationModes = {
    'simple': 'SIMPLE_OPTIMIZATIONS',
    'advanced': 'ADVANCED_OPTIMIZATIONS'
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Minifies a given Lo-Dash `source` and invokes the `options.onComplete`
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
    options = _.cloneDeep(options || {});

    // used to specify the default minifer modes
    var defaultModes = ['simple', 'advanced', 'hybrid'];

    // convert commands to an options object
    if (_.isArray(source)) {
      options = source;

      // used to specify the source map URL
      var sourceMapURL;

      // used to report invalid command-line arguments
      var invalidArgs = _.reject(options.slice(reNode.test(options[0]) ? 2 : 0), function(value, index, options) {
        if (/^(?:-o|--output)$/.test(options[index - 1]) ||
            /^modes=.*$/.test(value)) {
          return true;
        }
        var result = _.contains([
          '-o', '--output',
          '-p', '--source-map',
          '-s', '--silent',
          '-t', '--template'
        ], value);

        if (!result && /^(?:-p|--source-map)$/.test(options[index - 1])) {
          sourceMapURL = value;
          return true;
        }
        return result;
      });

      // report invalid arguments
      if (!_.isEmpty(invalidArgs)) {
        console.log('\nInvalid argument' + (_.size(invalidArgs) > 1 ? 's' : '') + ' passed: ' + invalidArgs.join(', '));
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
        'isMapped': getOption(options, '-p') || getOption(options, '--source-map'),
        'isSilent': getOption(options, '-s') || getOption(options, '--silent'),
        'isTemplate': getOption(options, '-t') || getOption(options, '--template'),
        'modes': getOption(options, 'modes', defaultModes),
        'outputPath': outputPath,
        'sourceMapURL': sourceMapURL
      };

      source = fs.readFileSync(filePath, 'utf8');
    }
    else {
      options.filePath = path.normalize(options.filePath);
      options.modes = _.result(options, 'modes', defaultModes);
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
   *  outputPath - Write output to a given path/filename.
   *  isSilent - Skip status updates normally logged to the console.
   *  isTemplate - Applies template specific minifier options.
   *  onComplete - The function called once minification has finished.
   */
  function Minify(source, options) {
    // juggle arguments
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

    // begin the minification process
    if (this.isMapped) {
      uglify.call(this, source, 'UglifyJS', onUglify.bind(this));
    } else if (_.contains(modes, 'simple')) {
      closureCompiler.call(this, source, 'simple', onClosureSimpleCompile.bind(this));
    } else if (_.contains(modes, 'advanced')) {
      onClosureSimpleGzip.call(this);
    } else {
      onClosureAdvancedGzip.call(this);
    }
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Asynchronously checks if Java is installed. The callback is invoked with
   * one argument; (success).
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
        result = !!_.result(/java version "(.*?)"/.exec(data.toString()), 1);
        if (!result) {
          java.emit('error');
        }
        callback(result);
      });

      java.on('error', function() {
        console.warn('The Closure Compiler requires Java. Skipping...');
      });
    };
  }());

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

  /*--------------------------------------------------------------------------*/

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
      // skip using the Closure Compiler if Java is not installed
      if (!success) {
        _.pull(modes, 'advanced', 'hybrid');
        callback();
        return;
      }
      // remove the copyright header to make other modifications easier
      var license = _.result(/^(?:\s*\/\/.*|\s*\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/)*\s*/.exec(source), 0, '');
      source = source.replace(license, '');

      var hasIIFE = /^;?\(function[^{]+{/.test(source),
          isStrict = /^;?\(function[^{]+{\s*["']use strict["']/.test(source);

      // to avoid stripping the IIFE, convert it to a function call
      if (hasIIFE) {
        source = source
          .replace(/\(function/, '__iife__$&')
          .replace(/\.call\(this\)\)([\s;]*(?:\n\/\/.+)?)$/, ', this)$1');
      }
      if (!isSilent) {
        console.log('Compressing ' + path.basename(outputPath, '.js') + ' using the Closure Compiler (' + mode + ')...');
      }
      compiler.compile(source, options, function(error, output) {
        if (error) {
          callback(error);
          return;
        }
        // restore IIFE and move exposed vars inside the IIFE
        if (hasIIFE) {
          output = output
            .replace(/\b__iife__\b/, '')
            .replace(/,\s*this\)([\s;]*(?:\n\/\/.+)?)$/, '.call(this))$1')
            .replace(/^((?:var (?:[$\w]+=(?:!0|!1|null)[,;])+)?)([\s\S]*?function[^{]+{)/, '$2$1');
        }
        // inject "use strict" directive
        if (isStrict) {
          output = output.replace(/^[\s\S]*?function[^{]+{/, '$&"use strict";');
        }
        // restore copyright header
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
    var uglifyJS = require('uglify-js');
    if (!this.isSilent) {
      console.log('Compressing ' + path.basename(this.outputPath, '.js') + ' using ' + label + '...');
    }
    try {
      var result = uglifyJS.minify(source, {
        'fromString': true,
        'outSourceMap': this.isMapped,
        'compress': {
          'comparisons': false,
          'unsafe': true,
          'unsafe_comps': true,
          'warnings': false
        },
        'mangle': {
          'except': ['define']
        },
        'output': {
          'ascii_only': !this.isTemplate,
          'comments': /^!|@cc_on|@license|@preserve/i,
          'max_line_len': 500,
        }
      });
    } catch(e) {
      var exception = e;
      result = {};
    }
    if (this.isMapped) {
      var mapPath = getMapPath(this.outputPath),
          sourceMapURL = this.sourceMapURL || path.basename(mapPath);

      _.assign(result, {
        'code': result.code.trimRight() + '\n//# sourceMappingURL=' + sourceMapURL,
        'map': JSON.stringify(_.assign(JSON.parse(result.map), {
          'file': path.basename(this.outputPath),
          'sources': [path.basename(this.filePath)]
        }))
      });
    }
    _.defer(callback, exception, result.code, result.map);
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The Closure Compiler callback for simple optimizations.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {string} result The minified source.
   */
  function onClosureSimpleCompile(exception, result) {
    if (exception) {
      throw exception;
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
   * @param {Object} [exception] The error object.
   * @param {Buffer} result The gzipped source buffer.
   */
  function onClosureSimpleGzip(exception, result) {
    if (exception) {
      throw exception;
    }
    if (result != null) {
      if (!this.isSilent) {
        console.log('Done. Size: %d bytes.', _.size(result));
      }
      this.compiled.simple.gzip = result;
    }
    // compile the source using advanced optimizations
    if (_.contains(this.modes, 'advanced')) {
      closureCompiler.call(this, this.source, 'advanced', onClosureAdvancedCompile.bind(this));
    } else {
      onClosureAdvancedGzip.call(this);
    }
  }

  /**
   * The Closure Compiler callback for advanced optimizations.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {string} result The minified source.
   */
  function onClosureAdvancedCompile(exception, result) {
    if (exception) {
      throw exception;
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
   * @param {Object} [exception] The error object.
   * @param {Buffer} result The gzipped source buffer.
   */
  function onClosureAdvancedGzip(exception, result) {
    if (exception) {
      throw exception;
    }
    if (result != null) {
      if (!this.isSilent) {
        console.log('Done. Size: %d bytes.', _.size(result));
      }
      this.compiled.advanced.gzip = result;
    }
    // minify the source using UglifyJS
    uglify.call(this, this.source, 'UglifyJS', onUglify.bind(this));
  }

  /**
   * The UglifyJS callback.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {string} result The minified source.
   * @param {string} map The source map output.
   */
  function onUglify(exception, result, map) {
    if (exception) {
      throw exception;
    }
    result = postprocess(result);
    _.assign(this.uglified, { 'source': result, 'sourceMap': map });
    gzip(result, onUglifyGzip.bind(this));
  }

  /**
   * The UglifyJS `gzip` callback.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {Buffer} result The gzipped source buffer.
   */
  function onUglifyGzip(exception, result) {
    if (exception) {
      throw exception;
    }
    if (result != null) {
      if (!this.isSilent) {
        console.log('Done. Size: %d bytes.', _.size(result));
      }
      this.uglified.gzip = result;
    }
    // minify the already Closure Compiler simple optimized source using UglifyJS
    var modes = this.modes;
    if (_.contains(modes, 'hybrid')) {
      if (_.contains(modes, 'simple')) {
        uglify.call(this, this.compiled.simple.source, 'hybrid (simple)', onSimpleHybrid.bind(this));
      } else if (_.contains(modes, 'advanced')) {
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
   * @param {Object} [exception] The error object.
   * @param {string} result The minified source.
   */
  function onSimpleHybrid(exception, result) {
    if (exception) {
      throw exception;
    }
    result = postprocess(result);
    this.hybrid.simple.source = result;
    gzip(result, onSimpleHybridGzip.bind(this));
  }

  /**
   * The hybrid `gzip` callback for simple optimizations.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {Buffer} result The gzipped source buffer.
   */
  function onSimpleHybridGzip(exception, result) {
    if (exception) {
      throw exception;
    }
    if (result != null) {
      if (!this.isSilent) {
        console.log('Done. Size: %d bytes.', _.size(result));
      }
      this.hybrid.simple.gzip = result;
    }
    // minify the already Closure Compiler advance optimized source using UglifyJS
    if (_.contains(this.modes, 'advanced')) {
      uglify.call(this, this.compiled.advanced.source, 'hybrid (advanced)', onAdvancedHybrid.bind(this));
    } else {
      onComplete.call(this);
    }
  }

  /**
   * The hybrid callback for advanced optimizations.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {string} result The minified source.
   */
  function onAdvancedHybrid(exception, result) {
    if (exception) {
      throw exception;
    }
    result = postprocess(result);
    this.hybrid.advanced.source = result;
    gzip(result, onAdvancedHybridGzip.bind(this));
  }

  /**
   * The hybrid `gzip` callback for advanced optimizations.
   *
   * @private
   * @param {Object} [exception] The error object.
   * @param {Buffer} result The gzipped source buffer.
   */
  function onAdvancedHybridGzip(exception, result) {
    if (exception) {
      throw exception;
    }
    if (result != null) {
      if (!this.isSilent) {
        console.log('Done. Size: %d bytes.', _.size(result));
      }
      this.hybrid.advanced.gzip = result;
    }
    // finish by choosing the smallest compressed file
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

    // select the smallest gzipped file and use its minified counterpart as the
    // official minified release (ties go to the Closure Compiler)
    var min = _.size(_.min(gzips, 'length'));

    // pass the minified source to the "onComplete" callback
    _.each(objects, function(data) {
      if (_.size(data.gzip) == min) {
        data.outputPath = this.outputPath;
        this.onComplete(data);
        return false;
      }
    }, this);
  }

  /*--------------------------------------------------------------------------*/

  // export `minify`
  if (module != require.main) {
    module.exports = minify;
  }
  // read the Lo-Dash source file from the first argument if the script
  // was invoked directly (e.g. `node minify.js source.js`) and write to
  // `<filename>.min.js`
  else if (_.size(process.argv) > 2) {
    minify(process.argv);
  }
}());
