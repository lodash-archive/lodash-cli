'use strict';

/** Load Node.js modules */
var vm = require('vm');

/** Load other modules */
var _ = require('lodash/lodash.js'),
    build = require('../bin/lodash'),
    minify = require('../lib/minify.js'),
    util = require('../lib/util.js');

/** Module references */
var fs = util.fs,
    path = util.path;

/** The unit testing framework */
var QUnit = (
  global.addEventListener = Function.prototype,
  global.QUnit = require('qunitjs'),
  require('qunit-extras').runInContext(global),
  delete global.addEventListener,
  global.QUnit
);

/** Used to avoid `noglobal` false positives caused by `errno` leaked in Node.js */
global.errno = true;

/** The current working directory */
var cwd = process.cwd();

/** Used to indicate if running in Windows */
var isWindows = process.platform == 'win32';

/** Used to prefix relative paths from the current directory */
var relativePrefix = '.' + path.sep;

/** Used to match the copyright header in builds */
var reHeader = /^\/\**[\s\S]+?\*\/\n/;

/** Shortcut used to push arrays of values to an array */
var push = Array.prototype.push;

/** The time limit for the tests to run (milliseconds) */
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

/** Used to map aliases with their real names */
var aliasToRealMap = createMap({
  'all': 'every',
  'any': 'some',
  'collect': 'map',
  'detect': 'find',
  'each': 'forEach',
  'eachRight': 'forEachRight',
  'extend': 'assign',
  'foldl': 'reduce',
  'foldr': 'reduceRight',
  'head': 'first',
  'include': 'contains',
  'inject': 'reduce',
  'iteratee': 'callback',
  'methods': 'functions',
  'object': 'zipObject',
  'select': 'filter',
  'tail': 'rest',
  'toJSON': 'wrapperValueOf',
  'unique': 'uniq',
  'value': 'wrapperValueOf'
});

/** Used to map real names with their aliases */
var realToAliasMap = createMap({
  'assign': ['extend'],
  'callback': ['iteratee'],
  'contains': ['include'],
  'every': ['all'],
  'filter': ['select'],
  'find': ['detect'],
  'first': ['head'],
  'forEach': ['each'],
  'forEachRight': ['eachRight'],
  'functions': ['methods'],
  'map': ['collect'],
  'reduce': ['foldl', 'inject'],
  'reduceRight': ['foldr'],
  'rest': ['tail'],
  'some': ['any'],
  'uniq': ['unique'],
  'wrapperValueOf': ['toJSON', 'value'],
  'zipObject': ['object']
});

/** Used to track the category of identifiers */
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
    'wrapperChain',
    'wrapperToString',
    'wrapperValueOf'
  ],
  'Collection': [
    'at',
    'contains',
    'countBy',
    'every',
    'filter',
    'find',
    'findLast',
    'findWhere',
    'forEach',
    'forEachRight',
    'groupBy',
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
    'toArray',
    'where'
  ],
  'Function': [
    'after',
    'before',
    'bind',
    'bindAll',
    'bindKey',
    'compose',
    'curry',
    'curryRight',
    'debounce',
    'defer',
    'delay',
    'memoize',
    'negate',
    'once',
    'partial',
    'partialRight',
    'throttle',
    'wrap'
  ],
  'Object': [
    'assign',
    'clone',
    'cloneDeep',
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
    'isNull',
    'isNumber',
    'isObject',
    'isPlainObject',
    'isRegExp',
    'isString',
    'isUndefined',
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
    'unescape'
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
    'random',
    'range',
    'result',
    'runInContext',
    'times',
    'uniqueId'
  ]
});

/** List of Backbone's Lo-Dash dependencies */
var backboneDependencies = [
  'bind',
  'bindAll',
  'chain',
  'clone',
  'contains',
  'countBy',
  'defaults',
  'difference',
  'escape',
  'every',
  'extend',
  'filter',
  'find',
  'first',
  'forEach',
  'groupBy',
  'has',
  'indexBy',
  'indexOf',
  'initial',
  'invert',
  'invoke',
  'isArray',
  'isEmpty',
  'isEqual',
  'isFunction',
  'isObject',
  'isRegExp',
  'isString',
  'keys',
  'last',
  'lastIndexOf',
  'lodash',
  'map',
  'max',
  'min',
  'mixin',
  'omit',
  'once',
  'pairs',
  'pick',
  'reduce',
  'reduceRight',
  'reject',
  'rest',
  'result',
  'sample',
  'shuffle',
  'size',
  'some',
  'sortBy',
  'sortedIndex',
  'toArray',
  'uniqueId',
  'value',
  'values',
  'without',
  'wrapperChain',
  'wrapperValueOf'
];

/** List of Lo-Dash only functions */
var lodashOnlyFuncs = [
  'at',
  'attempt',
  'before',
  'bindKey',
  'callback',
  'camelCase',
  'capitalize',
  'chunk',
  'cloneDeep',
  'create',
  'curry',
  'curryRight',
  'dropRight',
  'dropRightWhile',
  'dropWhile',
  'endsWith',
  'escapeRegExp',
  'findIndex',
  'findKey',
  'findLast',
  'findLastIndex',
  'findLastKey',
  'flattenDeep',
  'forEachRight',
  'forIn',
  'forInRight',
  'forOwn',
  'forOwnRight',
  'isError',
  'isPlainObject',
  'kebabCase',
  'keysIn',
  'mapValues',
  'merge',
  'negate',
  'noop',
  'pad',
  'padLeft',
  'padRight',
  'parseInt',
  'partialRight',
  'pull',
  'pullAt',
  'remove',
  'repeat',
  'runInContext',
  'slice',
  'snakeCase',
  'sortedLastIndex',
  'startsWith',
  'takeRight',
  'takeRightWhile',
  'takeWhile',
  'transform',
  'trunc',
  'trim',
  'trimLeft',
  'trimRight',
  'unzip',
  'valuesIn',
  'wrapperToString',
  'xor'
];

/** List of all functions */
var allFuncs = _.reject(_.functions(_), _.bind(RegExp.prototype.test, /^_/)).sort();

/** List of Underscore functions */
var underscoreFuncs = _.filter(_.difference(allFuncs, lodashOnlyFuncs), function(funcName, index, array) {
  var realName = aliasToRealMap[funcName];
  return !realName || _.contains(array, realName);
});

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
    if (_.contains(categoryMap.Array, methodName)) {
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
    else if (_.contains(categoryMap.Chain, methodName)) {
      lodash(array)[methodName](_.noop);
    }
    else if (_.contains(categoryMap.Collection, methodName)) {
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
    else if (_.contains(categoryMap.Function, methodName)) {
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
    else if (_.contains(categoryMap.Object, methodName)) {
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
    else if (_.contains(categoryMap.Utility, methodName)) {
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
    '-s strict underscore'
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
    'legacy',
    'mobile',
    'modern backbone',
    'modern template=./*.jst',
    'modern underscore'
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
      // uses the same regexp from the r.js build optimizer
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

        ok(_.contains(basename, 'lodash.templates'), basename);

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
    var expectedId = /underscore/.test(command) ? 'underscore' : 'lodash';

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
        strictEqual(_.templates.f({ 'name': 'mustache' }), 'hall\xE5 mustache!', basename);

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
        // manually create template `'".jst` to avoid issues in Windows
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

  _.each(idCommands, function(command, index) {
    var expectedId = /underscore/.test(command) ? 'underscore' : '';

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
      build([option, '-s', 'backbone'], function(data) {
        var comment = _.result(data.source.match(reLicense), 0, '');
        ok(_.contains(comment, 'Custom Build'));
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
      build([option, '-s', 'backbone'], function(data) {
        var comment = _.result(data.source.match(reLicense), 0, '');
        ok(_.contains(comment, 'Custom Build'));
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
      // remove copyright header before adding to `sources`
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
        if (!_.contains(outputCommand, '-p')) {
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

QUnit.module('underscore modifier');

(function() {
  asyncTest('modified methods should work correctly', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'underscore'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;

      var object = {
        'fn': lodash.bind(function(foo) {
          return foo + this.bar;
        }, { 'bar': 1 }, 1)
      };

      strictEqual(object.fn(), 2, '_.bind: ' + basename);

      var array = [{ 'a': 1, 'b': 2 }, { 'a': 2, 'b': 2 }];

      var actual = lodash.clone('a', function() {
        return this.a;
      }, { 'a': 'A' });

      strictEqual(actual, 'a', '_.clone should ignore `callback` and `thisArg`: ' + basename);
      strictEqual(lodash.clone(array, true)[0], array[0], '_.clone should ignore `deep`: ' + basename);

      strictEqual(lodash.contains({ 'a': 1, 'b': 2 }, 1), true, '_.contains should work with objects: ' + basename);
      strictEqual(lodash.contains([1, 2, 3], 1, 2), true, '_.contains should ignore `fromIndex`: ' + basename);
      strictEqual(lodash.every([true, false, true]), false, '_.every: ' + basename);

      function Foo() {}
      Foo.prototype = { 'a': 1 };

      deepEqual(lodash.defaults({}, new Foo), Foo.prototype, '_.defaults should assign inherited `source` properties: ' + basename);
      deepEqual(lodash.extend({}, new Foo), Foo.prototype, '_.extend should assign inherited `source` properties: ' + basename);

      var callback = function(a, b) {
        return this[b];
      };

      actual = lodash.extend({}, { 'a': 0 }, callback, [2]);
      strictEqual(actual.a, 0, '_.extend should ignore `callback` and `thisArg`: ' + basename);

      var expected = { 'a': 1, 'b': 2, 'c': 3};
      array = [{ 'b': 2 }, { 'c': 3 }];

      actual = _.reduce(array, lodash.extend, { 'a': 1});
      deepEqual(actual, expected, '_.extend should work with _.reduce: ' + basename);

      actual = _.reduce(array, lodash.defaults, { 'a': 1});
      deepEqual(actual, expected, '_.defaults should work with _.reduce: ' + basename);

      array = [{ 'a': 1, 'b': 2 }, { 'a': 2, 'b': 2 }];
      actual = lodash.find(array, function(value) {
        return 'a' in value;
      });

      strictEqual(actual, _.first(array), '_.find: ' + basename);

      var last;
      actual = lodash.forEach(array, function(value) {
        last = value;
        return false;
      });

      strictEqual(last, _.last(array), '_.forEach should not exit early: ' + basename);

      callback = function(value, index) {
        actual = this[index];
      };

      actual = undefined;
      lodash.forEach([1], callback, [2]);
      strictEqual(actual, 2, '_.forEach supports the `thisArg` argument when iterating arrays: ' + basename);

      lodash.forEach({ 'a': 1 }, callback, { 'a': 2 });
      strictEqual(actual, 2, '_.forEach supports the `thisArg` argument when iterating objects: ' + basename);

      array = [[[['a']]], [[['b']]]];
      deepEqual(lodash.flatten(array), ['a', 'b'], '_.flatten should perform a deep flatten by default: ' + basename);

      actual = _.map(array, lodash.flatten);
      deepEqual(actual, [['a'], ['b']], '_.flatten should perform a deep flatten when used as `callback` for _.map: ' + basename);

      object = { 'length': 0, 'splice': Array.prototype.splice };
      strictEqual(lodash.isEmpty(object), false, '_.isEmpty should return `false` for jQuery/MooTools DOM query collections: ' + basename);

      object = { 'a': 1, 'b': 2, 'c': 3 };
      strictEqual(lodash.isEqual(object, { 'a': 1, 'b': 0, 'c': 3 }), false, '_.isEqual: ' + basename);

      actual = lodash.isEqual('a', 'b', function(a, b) {
        return this[a] === this[b];
      }, { 'a': 1, 'b': 1 });

      strictEqual(actual, false, '_.isEqual should ignore `callback` and `thisArg`: ' + basename);
      deepEqual(lodash.keys('abc'), [], '_.keys should return an empty array for string primitives: ' + basename);
      strictEqual(lodash.lastIndexOf([3, 2, 1], 3, true), 0, '_.lastIndexOf should not support binary search: ' + basename);

      strictEqual(lodash.max('abc'), -Infinity, '_.max should return `-Infinity` for strings: ' + basename);
      strictEqual(lodash.min('abc'), Infinity, '_.min should return `Infinity` for strings: ' + basename);

      array = [[2, 3, 1], [5, 6, 4], [8, 9, 7]];
      deepEqual(_.map(array, lodash.max), [3, 6, 9], '_.max should work when used as `callback` for _.map: ' + basename);
      deepEqual(_.map(array, lodash.min), [1, 4, 7], '_.min should work when used as `callback` for _.map: ' + basename);

      object = {};
      lodash.mixin(object, { 'a': _.noop });
      ok(!('a' in object), '_.mixin should not accept a destination object: ' + basename);

      // avoid comparing objects created by `lodash` methods with `deepEqual`
      // because QUnit has problems comparing objects from different realms
      object = { 'a': 1, 'b': 2, 'c': 3 };
      actual = lodash.omit(object, function(value) { return value === 3; });
      deepEqual(_.keys(actual).sort(), ['a', 'b', 'c'], '_.omit should not accept a `callback`: ' + basename);

      actual = lodash.pick(object, function(value) { return value !== 3; });
      deepEqual(_.keys(actual), [], '_.pick should not accept a `callback`: ' + basename);

      actual = lodash.omit({ '0': 'a' }, 0);
      deepEqual(_.keys(actual), [], '_.omit should coerce property names to strings: ' + basename);

      actual = lodash.pick({ '0': 'a', '1': 'b' }, 0);
      deepEqual(_.keys(actual), ['0'], '_.pick should coerce property names to strings: ' + basename);

      actual = lodash.random(2, 4, true);
      ok(!(actual % 1) && actual >= 2 && actual <= 4, '_.random should ignore `floating`: ' + basename);

      deepEqual(lodash.range(1, 4, 0), [1, 2, 3], '_.range should not support a `step` of `0`');
      strictEqual(lodash.result({}, 'a', 1), undefined, '_.result should ignore `defaultValue`: ' + basename);
      strictEqual(lodash.some([false, true, false]), true, '_.some: ' + basename);

      actual = lodash.tap([], function(value) { value.push(this); }, 'a');
      deepEqual(actual, [undefined], '_.tap should ignore `thisArg`: ' + basename);

      strictEqual(lodash.template('${a}', object), '${a}', '_.template should ignore ES6 delimiters: ' + basename);
      ok(!('support' in lodash), '_.support should not exist: ' + basename);
      ok(!('imports' in lodash.templateSettings), '_.templateSettings should not have an "imports" property: ' + basename);

      array = [[2, 1, 2], [1, 2, 1]];
      actual = _.map(array, lodash.uniq);
      deepEqual(actual, [[2, 1], [1, 2]], '_.uniq should perform an unsorted uniq operation when used as `callback` for _.map: ' + basename);

      strictEqual(lodash.uniqueId(0), '1', '_.uniqueId should ignore a prefix of `0`: ' + basename);

      var collection = [{ 'a': { 'b': 1, 'c': 2 } }];
      deepEqual(lodash.where(collection, { 'a': { 'b': 1 } }), [], '_.where performs shallow comparisons: ' + basename);

      expected = [[['fred', 30, true]], [['barney', 40, false]]];
      actual = lodash.zip(lodash.zip(['fred', 'barney'], [30, 40], [true, false]));
      deepEqual(actual, expected, '_.zip is unable to correctly consume it\'s output: ' + basename);

      _.each(['difference', 'intersection', 'unique'], function(methodName) {
        try {
          var actual = lodash[methodName]();
        } catch(e) {}
        deepEqual(actual, [], '_.' + methodName + ' should return an empty array when no `array` argument is provided: ' + basename);
      });

      start();
    });
  });

  asyncTest('should have AMD support', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'underscore'], function(data) {
      var actualId,
          basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      context.define = function(id, factory) {
        actualId = id;
        context._ = factory();
      };

      context.define.amd = {};
      vm.runInContext(data.source, context);

      strictEqual(actualId, 'underscore', basename);
      ok(_.isFunction(context._), basename);

      start();
    });
  });

  asyncTest('should not have any Lo-Dash-only methods', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'underscore'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;

      _.each(lodashOnlyFuncs.concat('assign'), function(funcName) {
        ok(!(funcName in lodash), '_.' + funcName + ' should not exist: ' + basename);
      });

      start();
    });
  });

  asyncTest('`lodash underscore include=partial`', function() {
    var start = _.after(2, _.once(QUnit.start));

    build(['-s', 'underscore', 'include=partial'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;
      strictEqual(lodash.partial(_.identity, 2)(), 2, '_.partial: ' + basename);

      start();
    });
  });

  var commands = [
    'plus=clone',
    'plus=cloneDeep'
  ];

  _.each(commands, function(command, index) {
    asyncTest('`lodash underscore ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s', 'underscore', command], function(data) {
        var array = [{ 'value': 1 }],
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context, true);

        var lodash = context._;

        _.each(index ? ['clone','cloneDeep'] : ['clone'], function(funcName) {
          var clone = (funcName == 'clone')
            ? lodash.clone(array, true)
            : lodash.cloneDeep(array);

          ok(_.isEqual(array, clone), basename);
          notEqual(array[0], clone[0], basename);
        });

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('underscore chaining methods');

(function() {
  var commands = [
    'backbone',
    'underscore',
    'modern plus=chain'
  ];

  _.each(commands, function(command) {
    asyncTest('`lodash ' + command +'`', function() {
      var start = _.after(2, _.once(QUnit.start));

      build(['-s'].concat(command.split(' ')), function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context);

        var lodash = context._,
            array = ['abc'];

        ok(lodash.chain(array).first().first() instanceof lodash, '_.chain: ' + basename);
        ok(lodash(array).chain().first().first() instanceof lodash, '_#chain: ' + basename);

        var wrapped = lodash(1);
        strictEqual(wrapped.identity(), 1, '_(...) wrapped values are not chainable by default: ' + basename);
        ok(JSON.stringify(wrapped) !== '1' , '_#toJSON should not be implemented: ' + basename);
        ok(String(wrapped) !== '1', '_#toString should not be implemented: ' + basename);
        ok(Number(wrapped) !== 1 , '_#valueOf should not be implemented: ' + basename);

        wrapped.chain();
        ok(wrapped.has('x') instanceof lodash, '_#has returns wrapped values when chaining: ' + basename);
        ok(wrapped.join() instanceof lodash, '_#join returns wrapped values when chaining: ' + basename);

        wrapped = lodash([1, 2, 3]);
        ok(wrapped.pop() instanceof lodash, '_#pop returns wrapped values: ' + basename);
        ok(wrapped.shift() instanceof lodash, '_#shift returns wrapped values: ' + basename);
        deepEqual(wrapped.splice(0, 0).value(), [2], '_#splice returns wrapper: ' + basename);

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

  _.each(commands, function(command, index) {
    var expectedId = /underscore/.test(command) ? 'underscore' : 'lodash';

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
          dirs = _.contains(command, 'c.js'),
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

QUnit.module('underscore builds with lodash methods');

(function() {
  var funcNames = [
    'assign',
    'bindKey',
    'clone',
    'contains',
    'defaults',
    'difference',
    'every',
    'filter',
    'find',
    'findIndex',
    'findKey',
    'findLast',
    'findLastIndex',
    'findLastKey',
    'first',
    'flatten',
    'forEach',
    'forEachRight',
    'forIn',
    'forInRight',
    'forOwn',
    'forOwnRight',
    'intersection',
    'initial',
    'isEmpty',
    'isEqual',
    'isPlainObject',
    'isRegExp',
    'last',
    'map',
    'max',
    'memoize',
    'min',
    'omit',
    'partial',
    'partialRight',
    'pick',
    'pluck',
    'reduce',
    'reduceRight',
    'reject',
    'result',
    'rest',
    'some',
    'sortedIndex',
    'tap',
    'template',
    'throttle',
    'times',
    'toArray',
    'transform',
    'uniq',
    'uniqueId',
    'value',
    'zip'
  ];

  var tested = createMap();

  function strip(value) {
    return String(value)
      .replace(/^ *\/\/.*/gm, '')
      .replace(/\bcontext\b/g, '')
      .replace(/[\s;]/g, '');
  }

  _.each(funcNames, function(funcName) {
    _.times(2, function(index) {
      var command = 'underscore plus=' + funcName,
          expected = true;

      if (funcName != 'chain' && _.contains(categoryMap.Chain.concat('mixin'), funcName)) {
        if (funcName != 'tap') {
          expected = !!index;
        }
        if (index) {
          command += ',chain';
        }
      }
      if (_.contains([
            'every', 'filter', 'find', 'findIndex', 'findKey', 'findLast',
            'findLastIndex', 'findLastKey', 'map', 'max', 'min', 'omit', 'pick',
            'reduce', 'reduceRight', 'reject', 'some', 'sortedIndex', 'transform',
            'uniq'
          ], funcName)) {
        expected = !!index;
        if (index) {
          command += ',callback,forOwn';
        }
      }
      if (tested[command]) {
        return;
      }
      tested[command] = true;

      asyncTest('`lodash ' + command +'`', function() {
        var start = _.after(2, _.once(QUnit.start));

        build(['-s'].concat(command.split(' ')), function(data) {
          var basename = path.basename(data.outputPath, '.js'),
              context = createContext();

          vm.runInContext(data.source, context, true);

          var lodash = context._,
              func = lodash[funcName],
              array = [1, 2, 3],
              object = { 'a': 1, 'b': 2, 'c': 3 },
              result = [];

          if (/^for(?:Each|In|Own)(?:Right)?$/.test(funcName)) {
            func(/^forEach/.test(funcName) ? array : object, function(value) {
              result.push(value);
              return false;
            });

            strictEqual(result.length, 1, basename);
          }
          if (!/\.min$/.test(basename)) {
            var srcFnValue = strip(func),
                bldFnValue = strip(_[funcName]);

            strictEqual(srcFnValue === bldFnValue, expected, '\n' + srcFnValue + '\n' + bldFnValue);
          }
          testMethod(lodash, funcName, basename);

          start();
        });
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('lodash build');

(function() {
  var commands = [
    'backbone',
    'modern',
    'strict',
    'underscore',
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
    'backbone category=utility minus=first,last',
    'compat include=defer',
    'strict category=function exports=amd,global plus=pick,uniq',
    'modern strict include=isArguments,isArray,isFunction,isPlainObject,keys',
    'underscore include=debounce,throttle plus=after minus=throttle'
  ];

  push.apply(commands, _.map(allFuncs, function(funcName) {
    return 'include=' + funcName;
  }));

  var reNonCombinable = /\b(?:backbone|compat|modern|underscore)\b/;

  _.each(commands, function(origCommand) {
    _.each(['', 'modern', 'underscore'], function(otherCommand) {
      if ((otherCommand && reNonCombinable.test(origCommand)) ||
          (otherCommand == 'underscore' && /\bcategory\b/.test(origCommand))) {
        return;
      }
      var command = _.trim(otherCommand + ' ' + origCommand);

      asyncTest('`lodash ' + command +'`', function() {
        var start = _.after(2, _.once(QUnit.start));

        build(['--silent'].concat(command.split(' ')), function(data) {
          var basename = path.basename(data.outputPath, '.js'),
              context = createContext(),
              isBackbone = /\bbackbone\b/.test(command),
              isUnderscore = isBackbone || /\bunderscore\b/.test(command),
              exposeAssign = !isUnderscore,
              exposeZipObject = !isUnderscore;

          try {
            vm.runInContext(data.source, context);
          } catch(e) {
            console.log(e);
          }
          // add function names explicitly
          if (/\binclude=/.test(command)) {
            var funcNames = command.match(/\binclude=(\S*)/)[1].split(/, */);
          }
          if (/\bcategory=/.test(command)) {
            var categories = command.match(/\bcategory=(\S*)/)[1].split(/, */);
            funcNames || (funcNames = []);
            push.apply(funcNames, _.map(categories, _.compose(_.capitalize, _.partial(_.result, _, 'toLowerCase'))));
          }
          // add function names required by Backbone and Underscore builds
          if (/\bbackbone\b/.test(command) && !funcNames) {
            funcNames = backboneDependencies.slice();
          }
          if (isUnderscore) {
            if (funcNames) {
              exposeAssign = _.contains(funcNames, 'assign');
              exposeZipObject = _.contains(funcNames, 'zipObject');
            } else {
              funcNames = underscoreFuncs.slice();
            }
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
          // expand categories to function names
          _.each(funcNames.slice(), function(category) {
            var otherNames = _.filter(categoryMap[category], function(key) {
              var type = typeof _[key];
              return type == 'function' || type == 'undefined';
            });

            // limit function names to those available for specific builds
            otherNames = _.intersection(otherNames,
              isBackbone ? backboneDependencies :
              isUnderscore ? underscoreFuncs :
              allFuncs
            );

            if (!_.isEmpty(otherNames)) {
              _.pull(funcNames, category);
              push.apply(funcNames, otherNames);
            }
          });

          // expand aliases and remove nonexistent and duplicate function names
          funcNames = _.uniq(_.intersection(expandFuncNames(funcNames), allFuncs));

          if (!exposeAssign) {
            _.pull(funcNames, 'assign');
          }
          if (!exposeZipObject) {
            _.pull(funcNames, 'zipObject');
          }
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
