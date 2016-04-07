'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    path = require('path');

/** Used to indicate if running in Windows. */
var isWindows = process.platform == 'win32';

/**
 * The escaped path separator used for inclusion in RegExp strings.
 *
 * @memberOf util.path
 * @type string
 */
var sepEscaped = _.escapeRegExp(path.sep);

/** Used to determine if a path is prefixed with a drive letter or dot-slash. */
var rePrefixed = RegExp('^(?:' + (isWindows ? '[a-zA-Z]:|' : '') + '\\.?)' + sepEscaped);

/*----------------------------------------------------------------------------*/

/**
 * Creates a hash object. If a `properties` object is provided, its own
 * enumerable properties are assigned to the created object.
 *
 * @memberOf util
 * @param {Object} [properties] The properties to assign to the object.
 * @returns {Object} Returns the new hash object.
 */
function Hash(properties) {
  return _.transform(properties, function(result, value, key) {
    result[key] = (_.isPlainObject(value) && !(value instanceof Hash))
      ? new Hash(value)
      : value;
  }, this);
}

Hash.prototype = Object.create(null);

/**
 * Makes the given `dirname` directory, without throwing errors for existing
 * directories and making parent directories as needed.
 *
 * @memberOf util.fs
 * @param {string} dirname The path of the directory.
 * @param {number|string} [mode='0777'] The permission mode.
 */
function mkdirpSync(dirname, mode) {
  var sep = path.sep;
  dirname = path.normalize(dirname);

  // Ensure relative paths are prefixed with `./`.
  if (!rePrefixed.test(dirname)) {
    dirname = '.' + sep + dirname;
  }
  dirname.split(sep).reduce(function(currPath, segment) {
    currPath += sep + segment;
    try {
      currPath = fs.realpathSync(currPath);
    } catch (e) {
      fs.mkdirSync(currPath, mode);
    }
    return currPath;
  });
}

/**
 * Removes files or directories and their contents recursively.
 *
 * @memberOf util.fs
 * @param {string} pathname The path of the file or directory.
 */
function rmrfSync(pathname) {
  var sep = path.sep;
  pathname = path.normalize(pathname);

  // Safety first! Limit to modifying lodash-cli.
  if (!_.startsWith(pathname, path.dirname(__dirname) + sep)) {
    return;
  }
  try {
    pathname = fs.realpathSync(pathname);
  } catch (e) {
    return;
  }
  if (!fs.statSync(pathname).isDirectory()) {
    fs.unlinkSync(pathname);
    return;
  }
  _.each(fs.readdirSync(pathname), function(identifier) {
    var currPath = path.join(pathname, identifier);
    if (fs.statSync(currPath).isDirectory()) {
      rmrfSync(currPath);
    } else {
      fs.unlinkSync(currPath);
    }
  });
  fs.rmdirSync(pathname);
}

/*----------------------------------------------------------------------------*/

/**
 * The utility object.
 *
 * @type Object
 */
var util = {

  'Hash': Hash,

  /**
   * The file system object.
   *
   * @memberOf util
   * @type Object
   */
  'fs': _.defaults(_.cloneDeep(fs), {
    'mkdirpSync': mkdirpSync,
    'rmrfSync': rmrfSync
  }),

  /**
   * The path object.
   *
   * @memberOf util
   * @type Object
   */
  'path': _.defaults(_.cloneDeep(path), {
    'sepEscaped': sepEscaped
  })
};

module.exports = util;
