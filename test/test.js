'use strict';

/** Load Node.js modules. */
var vm = require('vm');

/** Load other modules. */
var _ = require('lodash/lodash.js'),
    build = require('../bin/lodash'),
    minify = require('../lib/minify.js'),
    util = require('../lib/util.js');

/** Module references. */
var fs = util.fs,
    path = util.path;

/** The unit testing framework. */
var QUnit = (
  global.addEventListener = Function.prototype,
  global.QUnit = require('qunitjs'),
  require('qunit-extras').runInContext(global),
  delete global.addEventListener,
  global.QUnit
);

/** Used to avoid `noglobal` false positives caused by `errno` leaked in Node.js. */
global.errno = true;

/** The current working directory. */
var cwd = process.cwd();

/** Used to indicate if running in Windows. */
var isWindows = process.platform == 'win32';

/** Used to prefix relative paths from the current directory. */
var relativePrefix = '.' + path.sep;

/** Used to match the copyright header in builds. */
var reHeader = /^\/\**[\s\S]+?\*\/\n/;

/** Shortcut used to push arrays of values to an array. */
var push = Array.prototype.push;

/** The time limit for the tests to run (milliseconds). */
var timeLimit = _.reduce(process.argv, function(result, value, index) {
  if (/--time-limit/.test(value)) {
    return parseInt(process.argv[index + 1].replace(/(\d+h)?(\d+m)?(\d+s)?/, function(match, h, m, s) {
      return ((parseInt(h) || 0) * 3600000) +
             ((parseInt(m) || 0) * 60000) +
             ((parseInt(s) || 0) * 1000);
    })) || result;
  }
  return result;
}, 0);

/** Used to map aliases with their real names. */
var aliasToRealMap = createMap({
  'all': 'every',
  'any': 'some',
  'backflow': 'flowRight',
  'collect': 'map',
  'compose': 'flowRight',
  'contains': 'includes',
  'detect': 'find',
  'each': 'forEach',
  'eachRight': 'forEachRight',
  'extend': 'assign',
  'foldl': 'reduce',
  'foldr': 'reduceRight',
  'head': 'first',
  'include': 'includes',
  'inject': 'reduce',
  'iteratee': 'callback',
  'methods': 'functions',
  'object': 'zipObject',
  'select': 'filter',
  'tail': 'rest',
  'toJSON': 'wrapperValue',
  'unique': 'uniq',
  'valueOf': 'wrapperValue'
});

/** Used to map real names with their aliases. */
var realToAliasMap = createMap({
  'assign': ['extend'],
  'callback': ['iteratee'],
  'every': ['all'],
  'filter': ['select'],
  'find': ['detect'],
  'first': ['head'],
  'flowRight': ['backflow', 'compose'],
  'forEach': ['each'],
  'forEachRight': ['eachRight'],
  'functions': ['methods'],
  'includes': ['contains', 'include'],
  'map': ['collect'],
  'reduce': ['foldl', 'inject'],
  'reduceRight': ['foldr'],
  'rest': ['tail'],
  'some': ['any'],
  'uniq': ['unique'],
  'wrapperValue': ['toJSON', 'valueOf'],
  'zipObject': ['object']
});

/** Used to track the category of identifiers. */
var categoryMap = createMap({
  'Array': [
    'chunk',
    'compact',
    'difference',
    'drop',
    'dropRight',
    'dropRightWhile',
    'dropWhile',
    'findIndex',
    'findLastIndex',
    'first',
    'flatten',
    'flattenDeep',
    'indexOf',
    'initial',
    'intersection',
    'last',
    'lastIndexOf',
    'pull',
    'pullAt',
    'remove',
    'rest',
    'slice',
    'sortedIndex',
    'sortedLastIndex',
    'take',
    'takeRight',
    'takeRightWhile',
    'takeWhile',
    'union',
    'uniq',
    'unzip',
    'without',
    'xor',
    'zip',
    'zipObject'
  ],
  'Chain': [
    'chain',
    'lodash',
    'tap',
    'thru',
    'wrapperChain',
    'wrapperReverse',
    'wrapperToString',
    'wrapperValue'
  ],
  'Collection': [
    'at',
    'countBy',
    'every',
    'filter',
    'find',
    'findLast',
    'findWhere',
    'forEach',
    'forEachRight',
    'groupBy',
    'includes',
    'indexBy',
    'invoke',
    'map',
    'max',
    'min',
    'partition',
    'pluck',
    'reduce',
    'reduceRight',
    'reject',
    'sample',
    'shuffle',
    'size',
    'some',
    'sortBy',
    'sortByAll',
    'toArray',
    'where'
  ],
  'Function': [
    'after',
    'ary',
    'before',
    'bind',
    'bindAll',
    'bindKey',
    'curry',
    'curryRight',
    'debounce',
    'defer',
    'delay',
    'flow',
    'flowRight',
    'memoize',
    'negate',
    'once',
    'partial',
    'partialRight',
    'rearg',
    'throttle',
    'wrap'
  ],
  'Lang': [
    'clone',
    'cloneDeep',
    'isArguments',
    'isArray',
    'isBoolean',
    'isDate',
    'isElement',
    'isEmpty',
    'isEqual',
    'isError',
    'isFinite',
    'isFunction',
    'isNaN',
    'isNative',
    'isNull',
    'isNumber',
    'isObject',
    'isPlainObject',
    'isRegExp',
    'isString',
    'isUndefined'
  ],
  'Object': [
    'assign',
    'create',
    'defaults',
    'findKey',
    'findLastKey',
    'forIn',
    'forInRight',
    'forOwn',
    'forOwnRight',
    'functions',
    'has',
    'invert',
    'keys',
    'keysIn',
    'mapValues',
    'merge',
    'omit',
    'pairs',
    'pick',
    'transform',
    'values',
    'valuesIn'
  ],
  'String': [
    'camelCase',
    'capitalize',
    'deburr',
    'endsWith',
    'escape',
    'escapeRegExp',
    'kebabCase',
    'pad',
    'padLeft',
    'padRight',
    'repeat',
    'snakeCase',
    'startsWith',
    'template',
    'templateSettings',
    'trim',
    'trimLeft',
    'trimRight',
    'trunc',
    'unescape',
    'words'
  ],
  'Utility': [
    'attempt',
    'callback',
    'constant',
    'identity',
    'matches',
    'mixin',
    'noConflict',
    'noop',
    'now',
    'parseInt',
    'property',
    'propertyOf',
    'random',
    'range',
    'result',
    'runInContext',
    'times',
    'uniqueId'
  ]
});

/** List of all functions. */
var allFuncs = _.reject(_.functions(_).sort(), _.partial(_.startsWith, _, '_', 0));

/*----------------------------------------------------------------------------*/

/**
 * Creates a context object to use with `vm.runInContext`.
 *
 * @private
 * @param {string} [exportType=global] The module export type (i.e. "amd", "commonjs", "global", & "node").
 * @returns {Object} Returns a new context object.
 */
function createContext(exportType) {
  var context = vm.createContext({
    'clearTimeout': clearTimeout,
    'console': console,
    'setTimeout': setTimeout
  });

  switch (exportType) {
    case 'amd':
      context.define = function(factory) { context._ = factory(); };
      context.define.amd = {};
      break;

    case 'commonjs':
      context.exports = {};
      context.module = {};
      break;

    case 'node':
      context.exports = {};
      context.module = { 'exports': context.exports };
  }
  return context;
}

/**
 * Creates a map object. If a `properties` object is provided its own
 * enumerable properties are assigned to the created object.
 *
 * @private
 * @param {Object} [properties] The properties to assign to the object.
 * @returns {Object} Returns the new object.
 */
function createMap(properties) {
  return _.assign(Object.create(null), properties);
}

/**
 * Removes all own enumerable properties from a given object.
 *
 * @private
 * @param {Object} object The object to empty.
 */
function emptyObject(object) {
  _.forOwn(object, function(value, key, object) {
    delete object[key];
  });
}

/**
 * Expands a list of function names to include real and alias names.
 *
 * @private
 * @param {Array} funcNames The array of function names to expand.
 * @returns {Array} Returns a new array of expanded function names.
 */
function expandFuncNames(funcNames) {
  return _.reduce(funcNames, function(result, funcName) {
    var realName = getRealName(funcName);
    result.push(realName);
    push.apply(result, getAliases(realName));
    return result;
  }, []);
}

/**
 * Gets the aliases associated with a given function name.
 *
 * @private
 * @param {string} funcName The name of the function to get aliases for.
 * @returns {Array} Returns an array of aliases.
 */
function getAliases(funcName) {
  return realToAliasMap[funcName] || [];
}

/**
 * Gets the real name, not alias, of a given function name.
 *
 * @private
 * @param {string} funcName The name of the function to resolve.
 * @returns {string} Returns the real name.
 */
function getRealName(funcName) {
  return aliasToRealMap[funcName] || funcName;
}

/**
 * Tests if a given method can be called successfully.
 *
 * @private
 * @param {Object} lodash The built Lo-Dash object.
 * @param {string} funcName The name of the method to test.
 * @param {string} message The unit test message.
 */
function testMethod(lodash, methodName, message) {
  var pass = true,
      array = [['a', 1], ['b', 2], ['c', 3]],
      object = { 'a': 1, 'b': 2, 'c': 3 },
      string = 'abc',
      template = '<%= a %>',
      func = lodash[methodName];

  try {
    if (_.includes(categoryMap.Array, methodName)) {
      if (methodName == 'range') {
        func(2, 4);
      } else if (/^(?:difference|intersection|union|uniq|zip)/.test(methodName)) {
        func(array, array);
      } else if (/(?:indexOf|sortedIndex|without)$/i.test(methodName)) {
        func(array, string);
      } else {
        func(array);
      }
    }
    else if (_.includes(categoryMap.Chain, methodName)) {
      lodash(array)[methodName](_.noop);
    }
    else if (_.includes(categoryMap.Collection, methodName)) {
      if (methodName == 'at') {
        func(array, 0, 2);
        func(object, 'a', 'c');
      } else if (methodName == 'invoke') {
        func(array, 'slice');
        func(object, 'toFixed');
      } else if (methodName == 'where') {
        func(array, object);
        func(object, object);
      } else if (/^(?:count|group|sort)By$/.test(methodName)) {
        func(array, _.noop);
        func(array, string);
        func(object, _.noop);
        func(object, string);
      } else if (/^(?:size|toArray)$/.test(methodName)) {
        func(array);
        func(object);
      } else {
        func(array, _.noop, object);
        func(object, _.noop, object);
      }
    }
    else if (_.includes(categoryMap.Function, methodName)) {
      if (methodName == 'bindAll') {
        func({ 'noop': _.noop });
      } else if (methodName == 'bindKey') {
        func(lodash, 'identity', array, string);
      } else if (/^(?:after|before)$/.test(methodName)) {
        func(2, _.noop);
      } else if (/^(?:bind|partial(?:Right)?)$/.test(methodName)) {
        func(_.noop, object, array, string);
      } else if (/^(?:compose|memoize|wrap)$/.test(methodName)) {
        func(_.noop, _.noop);
      } else if (/^(?:debounce|throttle)$/.test(methodName)) {
        func(_.noop, 100);
      } else {
        func(_.noop);
      }
    }
    else if (_.includes(categoryMap.Object, methodName)) {
      if (methodName == 'clone') {
        func(object);
        func(object, true);
      } else if (methodName == 'has') {
        func(object, string);
      } else if (/^(?:assign|defaults|extend|merge)$/.test(methodName)) {
        func({}, object);
      } else if (/^for(?:In|Own)(?:Right)?$/.test(methodName)) {
        func(object, _.noop);
      } else if (/^(?:omit|pick)$/.test(methodName)) {
        func(object, 'b');
      } else {
        func(object);
      }
    }
    else if (_.includes(categoryMap.Utility, methodName)) {
      if (methodName == 'mixin') {
        func({});
      } else if (methodName == 'result') {
        func(object, 'b');
      } else if (methodName == 'runInContext') {
        func();
      } else if (methodName == 'template') {
        func(template, object);
        func(template, null, { 'imports': object })(object);
      } else if (methodName == 'times') {
        func(2, _.noop, object);
      } else {
        func(string, object);
      }
    }
  }
  catch(e) {
    console.log(e);
    pass = false;
  }
  ok(pass, '_.' + methodName + ': ' + message);
}

/*----------------------------------------------------------------------------*/

console.log('test.js invoked with arguments: ' + JSON.stringify(process.argv));

QUnit.module('build command checks');

(function() {
  var reHelp = /lodash --help/,
      write = process.stderr.write;

  var commands = [
    'node.EXE build -s modern',
    '-s strict compat'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'` is valid', function() {
      var start = _.after(2, _.once(function() {
        ok(true, 'should be valid');
        QUnit.start();
      }));

      build(command.split(' '), start);
    });
  });

  commands = [
    'csp',
    'exports=es6',
    'exports=npm',
    'modern template=./*.jst'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'` is invalid', function() {
      process.stderr.write = _.once(function(string) {
        ok(reHelp.test(string));

        process.stderr.write = write;
        QUnit.start();
      });

      build(command.split(' '), _.noop);
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('minified AMD snippet');

(function() {
  asyncTest('r.js build optimizer check', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus='], function(data) {
      // Test using the same regexp from the r.js build optimizer.
      var basename = path.basename(data.outputPath, '.js'),
          defineHasRegExp = /typeof\s+define\s*==(=)?\s*['"]function['"]\s*&&\s*typeof\s+define\.amd\s*==(=)?\s*['"]object['"]\s*&&\s*define\.amd/g;

      ok(defineHasRegExp.test(data.source), basename);
      start();
    });
  });

  asyncTest('Dojo builder check', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus='], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          reSpaceDefine = /\sdefine\(/;

      ok(reSpaceDefine.test(data.source), basename);
      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('template builds');

(function() {
  var templatePath = path.join(__dirname, 'fixture', 'template'),
      quotesTemplatePath = path.join(templatePath, 'c', '\'".jst');

  var commands = [
    'template=' + path.join('fixture', 'template', '*.jst'),
    'template=' + relativePrefix + path.join('fixture', 'template', '*.jst'),
    'template=' + path.join(templatePath, '*.jst'),
    'template=' + '*.jst'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(function() {
        process.chdir(cwd);
        QUnit.start();
      }));

      process.chdir(/=\*/.test(command) ? templatePath : __dirname);

      build(['-s', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        var object = {
          'a': { 'people': ['fred', 'barney', 'pebbles'] },
          'b': { 'name': 'fred' },
          'c': { 'name': 'es6' }
        };

        context._ = _;
        vm.runInContext(data.source, context);

        ok(_.includes(basename, 'lodash.templates'), basename);

        var actual = _.templates.a(object.a);
        strictEqual(actual.replace(/[\r\n]+/g, ''), '<ul><li>fred</li><li>barney</li><li>pebbles</li></ul>', basename);

        strictEqual(_.templates.b(object.b), 'hello fred!', basename);
        strictEqual(_.templates.c(object.c), 'hello es6', basename);
        deepEqual(_.difference(['a', 'b', 'c', 'd', 'e'], _.keys(_.templates)), [], basename);

        delete _.templates;
        start();
      });
    });
  });

  commands = [
    '',
    'moduleId=underscore'
  ];

  _.each(commands, function(command) {
    var expectedId = _.result(/underscore/.exec(command), 0, 'lodash');

    asyncTest('`lodash exports=amd' + (command ? ' ' + command + '`' : '` using the default `moduleId`'), function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', 'template=' + path.join(templatePath, '*.jst'), 'exports=amd'].concat(command || []), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(requires, factory) {
          factory(_);
          actualId = requires[0];
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        strictEqual(actualId, expectedId, basename);

        delete _.templates;
        start();
      });
    });

    asyncTest('`lodash settings=...' + (command ? ' ' + command : '') + '`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', 'template=' + path.join(templatePath, '*.tpl'), 'settings={interpolate:/{{([\\s\\S]+?)}}/}'].concat(command || []), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(requires, factory) {
          factory(_);
          actualId = requires[0];
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        strictEqual(actualId, expectedId, basename);
        strictEqual(_.templates.f({ 'name': 'mustache' }), 'hall\xe5 mustache!', basename);

        delete _.templates;
        start();
      });
    });
  });

  commands = [
    'template=' + path.join(templatePath, '**', '*.jst'),
    'template=' + path.join('**', '*.jst')
  ];

  _.each(commands, function(command, index) {
    asyncTest('recursive path `' + command + '`', function() {
      var start = _.after(2, _.once(function() {
        if (!isWindows) {
          fs.unlinkSync(quotesTemplatePath);
        }
        process.chdir(cwd);
        QUnit.start();
      }));

      if (index) {
        process.chdir(templatePath);
      }
      if (!isWindows) {
        // Manually create template `'".jst` to avoid issues in Windows.
        fs.writeFileSync(quotesTemplatePath, 'hello <%= name %>', 'utf8');
      }
      build(['-s', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context._ = _;
        vm.runInContext(data.source, context);

        strictEqual(_.templates.b({ 'name': 'fred' }), 'hello fred!', basename);
        strictEqual(_.templates.c({ 'name': 'barney' }), 'hello barney', basename);
        strictEqual(_.templates.c.c({ 'name': 'pebbles' }), 'hello pebbles!', basename);

        if (!isWindows) {
          strictEqual(_.templates.c['\'"']({ 'name': 'quotes' }), 'hello quotes', basename);
        }
        delete _.templates;
        start();
      });
    });
  });

  var exportsCommands = [
    'exports=amd',
    'exports=commonjs',
    'exports=global',
    'exports=node',
    'exports=none'
  ];

  _.each(exportsCommands, function(command, index) {
    asyncTest('should work with `' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s',  'template=' + path.join(templatePath, 'c.jst'), command], function(data) {
        var templates,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext(),
            defaultTemplates = { 'c': function() { return ''; } },
            source = data.source;

        switch(index) {
          case 0:
            context.define = function(requires, factory) { factory(_); };
            context.define.amd = {};
            vm.runInContext(source, context);

            templates = _.templates || defaultTemplates;
            break;

          case 1:
            context.exports = {};
            context.module = {};
            context.require = function() { return _; };
            vm.runInContext(source, context);

            templates = context.exports.templates || defaultTemplates;
            break;

          case 2:
            context._ = _;
            vm.runInContext(source, context);

            templates = context._.templates || defaultTemplates;
            break;

          case 3:
            context.exports = {};
            context.module = { 'exports': context.exports };
            context.require = function() { return _; };
            vm.runInContext(source, context);

            templates = context.module.exports || defaultTemplates;
            break;

          case 4:
            vm.runInContext(source, context);
            strictEqual(context._, undefined, basename);
        }
        if (templates) {
          strictEqual(templates.c({ 'name': 'fred' }), 'hello fred', basename);
        }
        delete _.templates;
        start();
      });
    });
  });

  var idCommands = [
    'moduleId=underscore',
    'moduleId=none'
  ];

  _.each(idCommands, function(command) {
    var expectedId = _.result(/underscore/.exec(command), 0, '');

    asyncTest('should work with `' + command + '`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', 'template=' + path.join(templatePath, 'd.jst'), command], function(data) {
        var actualId = '',
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.exports = {};
        context.module = { 'exports': context.exports };

        if (expectedId) {
          context.require = function(id) {
            actualId = id;
            return _;
          };
        } else {
          context.require = function() {
            throw new ReferenceError;
          };
        }
        vm.runInContext(data.source, context);

        var templates = context.module.exports || { 'd': function() { return ''; } },
            actual = templates.d({ 'name': 'fred & barney' });

        strictEqual(actualId, expectedId, basename);
        strictEqual(actual, '<span>hello fred &amp; barney!</span>', basename);

        delete _.templates;
        start();
      });
    });
  });

  asyncTest('`lodash iife=%output%`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'template=' + path.join(templatePath, 'c.jst'), 'iife=%output%'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext(),
          source = data.source;

      ok(!_.startsWith(source, 'null'), basename);

      context._ = _;
      vm.runInContext(source, context);

      strictEqual(_.templates.c({ 'name': 'fred' }), 'hello fred', basename);

      delete _.templates;
      start();
    });
  });

  asyncTest('should normalize template file path patterns', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'template=' + templatePath + path.sep + path.sep + 'c.jst'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      context._ = _;
      vm.runInContext(data.source, context);

      strictEqual(_.templates.c({ 'name': 'fred' }), 'hello fred', basename);

      delete _.templates;
      start();
    });
  });

  asyncTest('should not modify whitespace in templates', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'template=' + path.join(templatePath, 'e.jst')], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      context._ = _;
      vm.runInContext(data.source, context);

      strictEqual(_.templates.e({ 'value': '1' }), 'function  () {\n;\n  return 1 ;\n} ;', basename);

      delete _.templates;
      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('independent builds');

(function() {
  var reLicense = /^\/\**\s+\* @license[\s\S]+?\*\/\n/;

  var options = [
    '-d',
    '--development'
  ];

  _.each(options, function(option) {
    asyncTest('development build using `' + option + '`' , function() {
      var start = _.once(QUnit.start);
      build([option, '-s'], function(data) {
        strictEqual(path.basename(data.outputPath, '.js'), 'lodash');
        start();
      });
    });

    asyncTest('development custom build using `' + option + '`', function() {
      var start = _.once(QUnit.start);
      build([option, '-s', 'modern'], function(data) {
        var comment = _.result(data.source.match(reLicense), 0, '');
        ok(_.includes(comment, 'Custom Build'));
        strictEqual(path.basename(data.outputPath, '.js'), 'lodash.custom');

        start();
      });
    });
  });

  options = [
    '-p',
    '--production'
  ];

  _.each(options, function(option) {
    asyncTest('production build using `' + option + '`', function() {
      var start = _.once(QUnit.start);
      build([option, '-s'], function(data) {
        strictEqual(path.basename(data.outputPath, '.js'), 'lodash.min');
        start();
      });
    });

    asyncTest('production custom build using `' + option + '`', function() {
      var start = _.once(QUnit.start);
      build([option, '-s', 'modern'], function(data) {
        var comment = _.result(data.source.match(reLicense), 0, '');
        ok(_.includes(comment, 'Custom Build'));
        strictEqual(path.basename(data.outputPath, '.js'), 'lodash.custom.min');

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('compat modifier');

(function() {
  asyncTest('`lodash compat`', function() {
    var sources = [];

    var check = _.after(2, _.once(function() {
      strictEqual(sources[0], sources[1]);
      QUnit.start();
    }));

    var callback = function(data) {
      // Remove copyright header before adding to `sources`.
      sources.push(data.source.replace(reHeader, ''));
      check();
    };

    build(['-s', '-d'], callback);
    build(['-s', '-d', 'compat'], callback);
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('modern modifier');

(function() {
  asyncTest('`lodash modern`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'modern'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;
      strictEqual(lodash.isPlainObject(Object.create(null)), true, basename);

      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('modularize modifier');

(function() {
  var outputPath = path.join(__dirname, 'a');

  var reLicense = /@license\b/;

  var funcNames = [
    'lodash',
    'mixin',
    'template'
  ];

  function setup() {
    process.chdir(__dirname);
    fs.rmrfSync(outputPath);
  }

  _.each(funcNames, function(funcName) {
    asyncTest('`lodash modularize modern include=' + funcName + ' exports=node`', function() {
      var start = _.once(function() {
        process.chdir(cwd);
        QUnit.start();
      });

      setup();

      build(['modularize', 'modern', 'include=' + funcName, 'exports=node', '-o', outputPath], function() {
        emptyObject(require.cache);

        if (funcName == 'lodash') {
          var lodash = require(outputPath);
          ok(lodash(1) instanceof lodash, outputPath, '`lodash()` should return a `lodash` instance');
          ok(reLicense.test(fs.readFileSync(require.resolve(outputPath), 'utf-8')), 'lodash module should preserve the copyright header');
        }
        else {
          var modulePath = path.join(outputPath, funcName == 'mixin' ? 'utility' : 'string', funcName);
          lodash = {};
          lodash[funcName] = require(modulePath);

          ok(!fs.existsSync(path.join(outputPath, 'index.js')), 'should not create an index.js file');
          ok(!reLicense.test(fs.readFileSync(require.resolve(modulePath), 'utf-8')), funcName + ' module should not preserve the copyright header');
          testMethod(lodash, funcName);
        }
        start();
      });
    });
  });

  var commands = [
    'exports=commonjs',
    'exports=node'
  ];

  _.each(commands, function(command, index) {
    asyncTest('module aliases for `' + command + '`', function() {
      var start = _.once(function() {
        process.chdir(cwd);
        QUnit.start();
      });

      setup();

      build(['modularize', 'modern', command, '-o', outputPath], function() {
        emptyObject(require.cache);
        var lodash = require(outputPath);

        if (lodash._) {
          lodash = lodash._;
        }
        _.each(['array', 'chain', 'collection', 'function', 'object', 'utility'], function(category) {
          var categoryModule = require(path.join(outputPath, category)),
              funcNames = categoryMap[_.capitalize(category)];

          _.each(funcNames, function(funcName) {
            var aliases = getAliases(funcName);
            _.each(aliases, function(alias) {
              if (!(category == 'chain' && /^wrapper/.test(funcName))) {
                ok(_.isFunction(lodash[alias]), '`' + command + '` should have `' + alias + '` as an alias of `' + funcName + '` in lodash');
              }
              ok(_.isFunction(categoryModule[alias]), '`' + command + '` should have `' + alias + '` as an alias of `' + funcName + '` in lodash/' + category);
            });
          });
        });

        start();
      });
    });
  });

  asyncTest('`lodash modularize include=callback minus=pluck,where`', function() {
    var start = _.once(function() {
      process.chdir(cwd);
      QUnit.start();
    });

    setup();

    build(['modularize', 'include=callback', 'minus=pluck,where', 'exports=node', '-o', outputPath], function() {
      emptyObject(require.cache);

      var modulePath = path.join(outputPath, 'utility'),
          utilities = require(modulePath),
          lodash = { 'callback': utilities.callback },
          callback = lodash.callback('x'),
          object = { 'x': 1 };

      strictEqual(callback(object), object);

      callback = lodash.callback(object);
      strictEqual(callback(object), object);

      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('source-map modifier');

(function() {
  var mapCommands = [
    '-m',
    '-m custom.map',
    '--source-map',
    '--source-map custom.map'
  ];

  var outputCommands = [
    '',
    '-o foo.js',
    '-p -o bar.js'
  ];

  _.each(mapCommands, function(mapCommand) {
    _.each(outputCommands, function(outputCommand) {
      asyncTest('`lodash ' + mapCommand + (outputCommand ? ' ' + outputCommand : '') + '`', function() {
        var callback = _.once(function(data) {
          var basename = path.basename(data.outputPath, '.js'),
              sources = /foo.js/.test(outputCommand) ? ['foo.js'] : ['lodash' + (_.isEmpty(outputCommand) ? '.custom' : '') + '.js'],
              sourceMap = JSON.parse(data.sourceMap),
              sourceMapURL = (/\w+(?=\.map$)/.exec(mapCommand) || [basename])[0];

          ok(RegExp('\\n//# sourceMappingURL=' + sourceMapURL + '.map$').test(data.source), basename);
          strictEqual(sourceMap.file, basename + '.js', basename);
          deepEqual(sourceMap.sources, sources, basename);

          process.chdir(cwd);
          QUnit.start();
        });

        process.chdir(__dirname);

        outputCommand = outputCommand ? outputCommand.split(' ') : [];
        if (!_.includes(outputCommand, '-p')) {
          callback = _.after(2, callback);
        }
        build(['-s'].concat(mapCommand.split(' '), outputCommand), callback);
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('strict modifier');

(function() {
  var object = Object.freeze({
    'a': _.identity,
    'b': undefined
  });

  var modes = [
    'non-strict',
    'strict'
  ];

  _.each(modes, function(strictMode, index) {
    asyncTest(strictMode + ' should ' + (index ? 'error': 'silently fail') + ' attempting to overwrite read-only properties', function() {
      var commands = ['-s', 'include=bindAll,defaults,extend'],
          start = _.after(2, _.once(QUnit.start));

      if (index) {
        commands.push('strict');
      }
      build(commands, function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context);

        var lodash = context._;

        var actual = _.every([
          function() { lodash.bindAll(object); },
          function() { lodash.extend(object, { 'a': 1 }); },
          function() { lodash.defaults(object, { 'b': 2 }); }
        ], function(fn) {
          var pass = !index;
          try {
            fn();
          } catch(e) {
            pass = !!index;
          }
          return pass;
        });

        ok(actual, basename);

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('minus command');

(function() {
  asyncTest('`lodash minus=runInContext`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus=runInContext'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          array = [0];

      var actual = lodash.map(array, function() {
        return String(this[0]);
      }, array);

      deepEqual(actual, ['0'], basename);
      ok(!('runInContext' in lodash), basename);

      start();
    });
  });

  asyncTest('`lodash minus=value`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus=value'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;
      ok(lodash([1]) instanceof lodash, basename);
      deepEqual(_.keys(lodash.prototype), [], basename);

      start();
    });
  });

  asyncTest('`lodash minus=pluck`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus=pluck'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          callback = lodash.callback('x'),
          object = { 'x': 1 };

      strictEqual(callback(object), object, basename);

      callback = lodash.callback(object);
      strictEqual(callback(object), true, basename);

      start();
    });
  });

  asyncTest('`lodash minus=where`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus=where'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          callback = lodash.callback('x'),
          object = { 'x': 1 };

      strictEqual(callback(object), 1, basename);

      callback = lodash.callback(object);
      strictEqual(callback(object), object, basename);

      start();
    });
  });

  asyncTest('`lodash minus=pluck,where`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'minus=pluck,where'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          callback = lodash.callback('x'),
          object = { 'x': 1 };

      strictEqual(callback(object), object, basename);

      callback = lodash.callback(object);
      strictEqual(callback(object), object, basename);

      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('exports command');

(function() {
  var commands = [
    'exports=amd',
    'exports=commonjs',
    'exports=global',
    'exports=node',
    'exports=none'
  ];

  _.each(commands, function(command, index) {
    var exportType = command.split('=')[1];

    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext(exportType),
            pass = false,
            source = data.source;

        switch(exportType) {
          case 'amd':
            context.define = function(factory) {
              pass = true;
              context._ = factory();
            };
            context.define.amd = {};
            vm.runInContext(source, context);

            ok(pass, basename);
            ok(_.isFunction(context._), basename);
            break;

          case 'commonjs':
            vm.runInContext(source, context);
            ok(_.isFunction(context.exports._), basename);
            strictEqual(context._, undefined, basename);
            break;

          case 'global':
            vm.runInContext(source, context);
            ok(_.isFunction(context._), basename);
            break;

          case 'node':
            vm.runInContext(source, context);
            ok(_.isFunction(context.module.exports), basename);
            strictEqual(context._, undefined, basename);
            break;

          case 'none':
            vm.runInContext(source, context);
            strictEqual(context._, undefined, basename);
        }
        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('iife command');

(function() {
  var commands = [
    'iife=this["lodash"]=(function(){%output%;return _}())',
    'iife=define(function(){return (function(){%output%;return _}())});'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', 'exports=none', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(func) {
          context.lodash = func();
        };

        try {
          vm.runInContext(data.source, context);
        } catch(e) {
          console.log(e);
        }
        var lodash = context.lodash || {};
        ok(_.isString(lodash.VERSION), basename);

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('include command');

(function() {
  var commands = [
    'include=mixin',
    'include=mixin,tap',
    'include=mixin,value'
  ];

  _.each(commands, function(command, index) {
    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context);

        var lodash = context._;
        lodash.mixin({ 'x': _.noop });

        strictEqual(lodash.x, _.noop, basename);
        strictEqual(typeof lodash.prototype.x, 'function', basename);

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('moduleId command');

(function() {
  var commands = [
    'moduleId=underscore',
    'moduleId=lodash exports=amd'
  ];

  _.each(commands, function(command) {
    var expectedId = _.result(/underscore/.exec(command), 0, 'lodash');

    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s'].concat(command.split(' ')), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(id, factory) {
          actualId = id;
          context._ = factory();
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        strictEqual(actualId, expectedId, basename);
        ok(_.isFunction(context._), basename);

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('output option');

(function() {
  var outputPath = path.join(__dirname, 'a'),
      nestedPath = path.join(outputPath, 'b');

  var commands = [
    '-o a.js',
    '--output b.js',
    '-o ' + path.join('a', 'b', 'c.js'),
    '-o ' + relativePrefix + path.join('a', 'b', 'c.js'),
    '-o ' + path.join(nestedPath, 'c.js'),
    '-o name_with_keywords_like_category_include_plus_minus.js'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'`', function() {
      var counter = 0,
          dirs = _.includes(command, 'c.js'),
          expected = /(\w+)(?=\.js$)/.exec(command)[0];

      var start = _.after(2, _.once(function() {
        if (dirs) {
          fs.rmrfSync(outputPath);
        }
        process.chdir(cwd);
        QUnit.start();
      }));

      process.chdir(__dirname);

      build(['-s'].concat(command.split(' ')), function(data) {
        var basename = path.basename(data.outputPath, '.js');
        strictEqual(basename, expected + (counter++ ? '.min' : ''), command);
        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('stdout option');

(function() {
  var write = process.stdout.write;

  var commands = [
    '-c',
    '-c -d',
    '--stdout',
  ];

  _.each(commands, function(command, index) {
    asyncTest('`lodash ' + command +'`', function() {
      var written,
          start = _.once(QUnit.start);

      process.stdout.write = function(string) {
        written = string;
      };

      build(['exports=none', 'include=none'].concat(command.split(' ')), function(data) {
        ok(!('outputPath' in data));
        strictEqual(written, data.source);
        strictEqual(arguments.length, 1);

        process.stdout.write = write;
        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('lodash build');

(function() {
  var reNonCombinable = /\b(?:compat|modern)\b/;

  var commands = [
    'modern',
    'strict',
    'category=array',
    'category=chain',
    'category=collection',
    'category=function',
    'category=object',
    'category=utility',
    'minus=union,uniq,zip',
    'include=each,filter,map',
    'include=once plus=bind,Chain',
    'category=collection,function',
    'compat include=defer',
    'strict category=function exports=amd,global plus=pick,uniq',
    'modern strict include=isArguments,isArray,isFunction,isPlainObject,keys'
  ];

  push.apply(commands, _.map(allFuncs, function(funcName) {
    return 'include=' + funcName;
  }));

  _.each(commands, function(origCommand) {
    _.each(['', 'modern'], function(otherCommand) {
      if (otherCommand && reNonCombinable.test(origCommand)) {
        return;
      }
      var command = _.trim(otherCommand + ' ' + origCommand);

      asyncTest('`lodash ' + command +'`', function() {
        var start = _.after(2, _.once(QUnit.start));

        build(['--silent'].concat(command.split(' ')), function(data) {
          var basename = path.basename(data.outputPath, '.js'),
              context = createContext();

          try {
            vm.runInContext(data.source, context);
          } catch(e) {
            console.log(e);
          }
          // Add function names explicitly.
          if (/\binclude=/.test(command)) {
            var funcNames = command.match(/\binclude=(\S*)/)[1].split(/, */);
          }
          if (/\bcategory=/.test(command)) {
            var categories = command.match(/\bcategory=(\S*)/)[1].split(/, */);
            funcNames || (funcNames = []);
            push.apply(funcNames, _.map(categories, _.compose(_.capitalize, _.partial(_.result, _, 'toLowerCase'))));
          }
          if (!funcNames) {
            funcNames = allFuncs.slice();
          }
          if (/\bplus=/.test(command)) {
            var otherNames = command.match(/\bplus=(\S*)/)[1].split(/, */);
            push.apply(funcNames, expandFuncNames(otherNames));
          }
          if (/\bminus=/.test(command)) {
            otherNames = command.match(/\bminus=(\S*)/)[1].split(/, */);
            funcNames = _.difference(funcNames, expandFuncNames(otherNames));
          }
          // Expand categories to function names.
          _.each(funcNames.slice(), function(category) {
            var otherNames = _.filter(categoryMap[category], function(key) {
              var type = typeof _[key];
              return type == 'function' || type == 'undefined';
            });

            // Limit function names to those available for specific builds.
            otherNames = _.intersection(otherNames, allFuncs);

            if (!_.isEmpty(otherNames)) {
              _.pull(funcNames, category);
              push.apply(funcNames, otherNames);
            }
          });

          // Expand aliases and remove nonexistent and duplicate function names.
          funcNames = _.uniq(_.intersection(expandFuncNames(funcNames), allFuncs));

          var lodash = context._ || {};
          _.each(funcNames, _.partial(testMethod, lodash, _, basename));

          start();
        });
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

if (timeLimit > 0) {
  setTimeout(function() {
    process.exit(QUnit.config.stats.bad ? 1 : 0);
  }, timeLimit);
}
QUnit.config.hidepassed = true;
QUnit.config.noglobals = true;
QUnit.start();
