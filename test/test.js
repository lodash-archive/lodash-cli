'use strict';

/** Load Node.js modules. */
var vm = require('vm');

/** Load other modules. */
var _ = require('lodash'),
    build = require('../bin/lodash'),
    listing = require('../lib/listing.js'),
    mapping = require('../lib/mapping.js'),
    minify = require('../lib/minify.js'),
    util = require('../lib/util.js');

/** Module references. */
var fs = util.fs,
    path = util.path;

/** The unit testing framework. */
global.QUnit = require('qunitjs');
require('qunit-extras').runInContext(global);

/** Used to avoid `noglobal` false positives caused by `errno` leaked in Node.js. */
global.errno = true;

/** The current working directory. */
var cwd = process.cwd();

/** Used to indicate if running in Windows. */
var isWindows = process.platform == 'win32';

/** Used to prefix relative paths from the current directory. */
var relativePrefix = '.' + path.sep;

/** Used to match the copyright header in builds. */
var reHeader = /^\/\**\s+\* @license[\s\S]+?\*\/\n/;

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

/** List of lodash functions included by default. */
var includes = _.reject(_.functions(_).sort(), _.partial(_.startsWith, _, '_', 0));

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

    case 'iojs':
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
 * Gets the aliases associated with a given identifier.
 *
 * @private
 * @param {string} identifier The identifier to get aliases for.
 * @returns {Array} Returns an array of aliases.
 */
function getAliases(identifier) {
  return _.result(mapping.realToAlias, identifier, []);
}

/**
 * Gets the real name of `alias`.
 *
 * @private
 * @param {string} alias The alias to resolve.
 * @returns {string} Returns the real name.
 */
function getRealName(alias) {
  return _.result(mapping.aliasToReal, alias, alias);
}

/**
 * Gets the real category of `alias`.
 *
 * @private
 * @param {string} alias The alias to resolve.
 * @returns {string} Returns the real category.
 */
function getRealCategory(alias) {
  return _.result(mapping.oldCategory, alias, alias);
}

/**
 * Tests if a given method can be called successfully.
 *
 * @private
 * @param {Object} assert The QUnit assert object.
 * @param {Object} lodash The built lodash object.
 * @param {string} funcName The name of the method to test.
 * @param {string} message The unit test message.
 */
function testMethod(assert, lodash, methodName, message) {
  var pass = true,
      array = [['a', 1], ['b', 2], ['c', 3]],
      object = { 'a': 1, 'b': 2, 'c': 3 },
      string = 'abc',
      template = '<%= a %>',
      func = lodash[methodName];

  try {
    if (_.includes(mapping.category.Array, methodName)) {
      if (/^(?:difference|intersection|union|uniq|xor|zip(?:Object)?)$/.test(methodName)) {
        func(array);
      } else if (/^(?:indexOf|lastIndexOf|sorted(?:Last)?Index|without)$/.test(methodName)) {
        func(array, string);
      } else {
        func(array);
      }
    }
    else if (_.includes(mapping.category.Chain, methodName)) {
      lodash(array)[methodName](_.noop);
    }
    else if (_.includes(mapping.category.Collection, methodName)) {
      if (methodName == 'at') {
        func(array, 0, 2);
        func(object, 'a', 'c');
      } else if (methodName == 'invoke') {
        func(array, 'slice');
        func(object, 'constructor');
      } else if (/^(?:count|group|key|sort)By$/.test(methodName)) {
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
    else if (_.includes(mapping.category.Function, methodName)) {
      if (methodName == 'bindAll') {
        func({ 'noop': _.noop });
      } else if (methodName == 'bindKey') {
        func(lodash, 'identity');
      } else if (/^(?:after|before)$/.test(methodName)) {
        func(2, _.noop);
      } else if (/^(?:bind|partial(?:Right)?)$/.test(methodName)) {
        func(_.noop, object, 'a', 'c');
      } else if (/^(?:debounce|throttle)$/.test(methodName)) {
        func(_.noop, 100);
      } else if (/^(?:memoize|wrap)$/.test(methodName)) {
        func(_.noop, _.noop)();
      } else {
        func(_.noop);
      }
    }
    else if (_.includes(mapping.category.Object, methodName)) {
      if (methodName == 'clone') {
        func(object);
        func(object, true);
      } else if (methodName == 'has') {
        func(object, string);
      } else if (/^(?:assign(?:In)?|defaults|extend|merge)$/.test(methodName)) {
        func({}, object);
      } else if (/^for(?:In|Own)(?:Right)?$/.test(methodName)) {
        func(object, _.noop);
      } else if (/^(?:get|result)$/.test(methodName)) {
        func(object, 'b');
      } else if (/^(?:omit|pick)$/.test(methodName)) {
        func(object, 'b');
      } else {
        func(object);
      }
    }
    else if (_.includes(mapping.category.Utility, methodName)) {
      if (methodName == 'mixin') {
        func({});
      } else if (methodName == 'runInContext') {
        func();
      } else if (methodName == 'template') {
        func(template, object);
        func(template, null, { 'imports': object })(object);
      } else if (methodName == 'times') {
        func(2, _.noop, object);
      } else if (/^flow(?:Right)?$/.test(methodName)) {
        func(_.noop, _.noop)();
      } else if (/^range(?:Right)?$/.test(methodName)) {
        func(2, 4);
      } else {
        func(string, object);
      }
    }
  }
  catch (e) {
    console.log(e);
    pass = false;
  }
  assert.ok(pass, '_.' + methodName + ': ' + message);
}

/*----------------------------------------------------------------------------*/

console.log('test.js invoked with arguments: ' + JSON.stringify(process.argv));

QUnit.module('build command checks');

(function() {
  var reHelp = /lodash --help/;

  var commands = [
    'csp',
    'exports=es',
    'exports=es6',
    'exports=npm'
  ];

  _.each(commands, function(command) {
    QUnit.test('`lodash ' + command +'` is invalid', function(assert) {
      var done = assert.async();

      build(command.split(' '), function(data) {
        assert.ok(reHelp.test(data.source));
        done();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('minified AMD snippet');

(function() {
  QUnit.test('r.js build optimizer check', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus='], function(data) {
      // Test using the same regexp from the r.js build optimizer.
      var basename = path.basename(data.outputPath, '.js'),
          defineHasRegExp = /typeof\s+define\s*==(=)?\s*['"]function['"]\s*&&\s*typeof\s+define\.amd\s*==(=)?\s*['"]object['"]\s*&&\s*define\.amd/g;

      assert.ok(defineHasRegExp.test(data.source), basename);
      start();
    });
  });

  QUnit.test('Dojo builder check', function(assert) {
    var done = assert.async(),
        reSpaceDefine = /\sdefine\(/,
        start = _.after(2, _.once(done));

    build(['minus='], function(data) {
      var basename = path.basename(data.outputPath, '.js');
      assert.ok(reSpaceDefine.test(data.source), basename);
      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('template builds');

(function() {
  var templatePath = path.join(__dirname, 'fixture'),
      quotesTemplatePath = path.join(templatePath, 'c', '\'".jst'),
      reWildcard = /=\*/;

  var commands = [
    'template=' + path.join('fixture', '*.jst'),
    'template=' + relativePrefix + path.join('fixture','*.jst'),
    'template=' + path.join(templatePath, '*.jst'),
    'template=' + '*.jst'
  ];

  _.each(commands, function(command) {
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async();

      var start = _.after(2, _.once(function() {
        process.chdir(cwd);
        done();
      }));

      process.chdir(reWildcard.test(command) ? templatePath : __dirname);

      build([command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        var object = {
          'a': { 'people': ['fred', 'barney', 'pebbles'] },
          'b': { 'name': 'fred' },
          'c': { 'name': 'es' }
        };

        context._ = _;
        vm.runInContext(data.source, context);

        assert.ok(_.includes(basename, 'lodash.templates'), basename);

        var actual = _.templates.a(object.a);
        assert.strictEqual(actual.replace(/[\r\n]+/g, ''), '<ul><li>fred</li><li>barney</li><li>pebbles</li></ul>', basename);

        assert.strictEqual(_.templates.b(object.b), 'hello fred!', basename);
        assert.strictEqual(_.templates.c(object.c), 'hello es', basename);
        assert.deepEqual(_.difference(['a', 'b', 'c', 'd', 'e'], _.keys(_.templates)), [], basename);

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

    QUnit.test('`lodash exports=amd' + (command ? ' ' + command + '`' : '` using the default `moduleId`'), function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(['template=' + path.join(templatePath, '*.jst'), 'exports=amd'].concat(command || []), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(requires, factory) {
          factory(_);
          actualId = requires[0];
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        assert.strictEqual(actualId, expectedId, basename);

        delete _.templates;
        start();
      });
    });

    QUnit.test('`lodash settings=...' + (command ? ' ' + command : '') + '`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(['template=' + path.join(templatePath, '*.tpl'), 'settings={interpolate:/{{([\\s\\S]+?)}}/}'].concat(command || []), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(requires, factory) {
          factory(_);
          actualId = requires[0];
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        assert.strictEqual(actualId, expectedId, basename);
        assert.strictEqual(_.templates.f({ 'name': 'mustache' }), 'hall\xe5 mustache!', basename);

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
    QUnit.test('recursive path `' + command + '`', function(assert) {
      var done = assert.async();

      var start = _.after(2, _.once(function() {
        if (!isWindows) {
          fs.unlinkSync(quotesTemplatePath);
        }
        process.chdir(cwd);
        done();
      }));

      if (index) {
        process.chdir(templatePath);
      }
      if (!isWindows) {
        // Manually create template `'".jst` to avoid issues in Windows.
        fs.writeFileSync(quotesTemplatePath, 'hello <%= name %>', 'utf8');
      }
      build([command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context._ = _;
        vm.runInContext(data.source, context);

        assert.strictEqual(_.templates.b({ 'name': 'fred' }), 'hello fred!', basename);
        assert.strictEqual(_.templates.c({ 'name': 'barney' }), 'hello barney', basename);
        assert.strictEqual(_.templates.c.c({ 'name': 'pebbles' }), 'hello pebbles!', basename);

        if (!isWindows) {
          assert.strictEqual(_.templates.c['\'"']({ 'name': 'quotes' }), 'hello quotes', basename);
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
    QUnit.test('should work with `' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build([ 'template=' + path.join(templatePath, 'c.jst'), command], function(data) {
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
            assert.strictEqual(context._, undefined, basename);
        }
        if (templates) {
          assert.strictEqual(templates.c({ 'name': 'fred' }), 'hello fred', basename);
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

    QUnit.test('should work with `' + command + '`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(['template=' + path.join(templatePath, 'd.jst'), command], function(data) {
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

        assert.strictEqual(actualId, expectedId, basename);
        assert.strictEqual(actual, '<span>hello fred &amp; barney!</span>', basename);

        delete _.templates;
        start();
      });
    });
  });

  QUnit.test('`lodash iife=%output%`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['template=' + path.join(templatePath, 'c.jst'), 'iife=%output%'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext(),
          source = data.source;

      assert.notOk(_.startsWith(source, 'null'), basename);

      context._ = _;
      vm.runInContext(source, context);

      assert.strictEqual(_.templates.c({ 'name': 'fred' }), 'hello fred', basename);

      delete _.templates;
      start();
    });
  });

  QUnit.test('should normalize template file path patterns', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['template=' + templatePath + path.sep + path.sep + 'c.jst'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      context._ = _;
      vm.runInContext(data.source, context);

      assert.strictEqual(_.templates.c({ 'name': 'fred' }), 'hello fred', basename);

      delete _.templates;
      start();
    });
  });

  QUnit.test('should not modify whitespace in templates', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['template=' + path.join(templatePath, 'e.jst')], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      context._ = _;
      vm.runInContext(data.source, context);

      assert.strictEqual(_.templates.e({ 'value': '1' }), 'function  () {\n;\n  return 1 ;\n} ;', basename);

      delete _.templates;
      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('independent builds');

(function() {
  var options = [
    '-d',
    '--development'
  ];

  _.each(options, function(option) {
    QUnit.test('development build using `' + option + '`' , function(assert) {
      var done = assert.async(),
          start = _.once(done);

      build([option], function(data) {
        assert.strictEqual(path.basename(data.outputPath, '.js'), 'lodash');
        start();
      });
    });

    QUnit.test('development custom build using `' + option + '`', function(assert) {
      var done = assert.async(),
          start = _.once(done);

      build([option, 'strict'], function(data) {
        var comment = _.result(data.source.match(reHeader), 0, '');
        assert.ok(_.includes(comment, 'Custom Build'));
        assert.strictEqual(path.basename(data.outputPath, '.js'), 'lodash.custom');

        start();
      });
    });
  });

  options = [
    '-p',
    '--production'
  ];

  _.each(options, function(option) {
    QUnit.test('production build using `' + option + '`', function(assert) {
      var done = assert.async(),
          start = _.once(done);

      build([option], function(data) {
        assert.strictEqual(path.basename(data.outputPath, '.js'), 'lodash.min');
        start();
      });
    });

    QUnit.test('production custom build using `' + option + '`', function(assert) {
      var done = assert.async(),
          start = _.once(done);

      build([option, 'strict'], function(data) {
        var comment = _.result(data.source.match(reHeader), 0, '');
        assert.ok(_.includes(comment, 'Custom Build'));
        assert.strictEqual(path.basename(data.outputPath, '.js'), 'lodash.custom.min');

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('modularize modifier');

(function() {
  var outputPath = path.join(__dirname, 'a');

  var funcNames = [
    'main',
    'mixin',
    'template'
  ];

  function setup() {
    process.chdir(__dirname);
    fs.rmrfSync(outputPath);
  }

  _.each(funcNames, function(funcName) {
    QUnit.test('`lodash modularize include=' + funcName + ' exports=node`', function(assert) {
      var done = assert.async();

      var start = _.once(function() {
        process.chdir(cwd);
        done();
      });

      setup();

      build(['modularize', 'include=' + funcName, 'exports=node', '-o', outputPath], function() {
        emptyObject(require.cache);

        if (funcName == 'main') {
          var lodash = require(outputPath);
          assert.ok(lodash(1) instanceof lodash, outputPath, '`lodash()` should return a `lodash` instance');
          assert.ok(reHeader.test(fs.readFileSync(require.resolve(outputPath), 'utf-8')), 'lodash module should preserve the copyright header');
        }
        else {
          var modulePath = path.join(outputPath, funcName == 'mixin' ? 'utility' : 'string', funcName);
          lodash = {};
          lodash[funcName] = require(modulePath);

          assert.notOk(fs.existsSync(path.join(outputPath, 'index.js')), 'should not create an index.js file');
          assert.notOk(reHeader.test(fs.readFileSync(require.resolve(modulePath), 'utf-8')), funcName + ' module should not preserve the copyright header');
          testMethod(assert, lodash, funcName);
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
    QUnit.test('module aliases for `' + command + '`', function(assert) {
      var done = assert.async();

      var start = _.once(function() {
        process.chdir(cwd);
        done();
      });

      setup();

      build(['modularize', command, '-o', outputPath], function() {
        emptyObject(require.cache);
        var lodash = require(outputPath);

        if (lodash._) {
          lodash = lodash._;
        }
        _.each(['array', 'chain', 'collection', 'date', 'function', 'lang', 'number', 'object', 'string', 'utility'], function(category) {
          var categoryModule = require(path.join(outputPath, category)),
              funcNames = mapping.category[_.capitalize(category)];

          _.each(funcNames, function(funcName) {
            var aliases = getAliases(funcName);
            _.each(aliases, function(alias) {
              var objects = [(category == 'chain' ? lodash.prototype : lodash), categoryModule];
              _.each(objects, function(object, index) {
                var message = (
                  '`' + command + '` should have `' + alias + '` ' +
                  'as an alias of `' + funcName + '` in lodash' +
                  (index ? ('/' + category) : '')
                );

                var value = (!index && alias == 'toIterator')
                  ? object[Symbol.iterator]
                  : object[alias];

                assert.ok(_.isFunction(value), message);
              });
            });
          });
        });

        start();
      });
    });
  });

  QUnit.test('`lodash modularize include=iteratee minus=matches,property`', function(assert) {
    var done = assert.async();

    var start = _.once(function() {
      process.chdir(cwd);
      done();
    });

    setup();

    build(['modularize', 'include=iteratee', 'minus=matches,property', 'exports=node', '-o', outputPath], function() {
      emptyObject(require.cache);

      var modulePath = path.join(outputPath, 'utility'),
          utility = require(modulePath),
          iteratee = utility.iteratee('x'),
          object = { 'x': 1 };

      assert.strictEqual(iteratee(object), object);

      iteratee = utility.iteratee(object);
      assert.strictEqual(iteratee(object), object);

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
      QUnit.test('`lodash ' + mapCommand + (outputCommand ? ' ' + outputCommand : '') + '`', function(assert) {
        var done = assert.async();

        var callback = _.once(function(data) {
          var basename = path.basename(data.outputPath, '.js'),
              sources = [_.result(/\w+\.js$/.exec(outputCommand), 0, 'lodash.custom.js')],
              sourceMap = JSON.parse(data.sourceMap),
              sourceMapURL = _.result(/\w+\.map$/.exec(mapCommand), 0, basename + '.map');

          assert.ok(RegExp('\\n//# sourceMappingURL=' + sourceMapURL + '$').test(data.source), basename);
          assert.strictEqual(sourceMap.file, basename + '.js', basename);
          assert.deepEqual(sourceMap.sources, sources, basename);

          process.chdir(cwd);
          done();
        });

        process.chdir(__dirname);

        outputCommand = outputCommand ? outputCommand.split(' ') : [];
        if (!_.includes(outputCommand, '-p')) {
          callback = _.after(2, callback);
        }
        build(mapCommand.split(' ').concat(outputCommand), callback);
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
    QUnit.test(strictMode + ' should ' + (index ? 'error': 'silently fail') + ' attempting to overwrite read-only properties', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done)),
          commands = ['include=bindAll,defaults,extend'];

      if (index) {
        commands.push('strict');
      }
      build(commands, function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context);

        var lodash = context._;

        var actual = _.every([
          function() { lodash.bindAll(object, 'a'); },
          function() { lodash.extend(object, { 'a': 1 }); },
          function() { lodash.defaults(object, { 'b': 2 }); }
        ], function(fn) {
          var pass = !index;
          try {
            fn();
          } catch (e) {
            pass = !!index;
          }
          return pass;
        });

        assert.ok(actual, basename);

        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('minus command');

(function() {
  QUnit.test('`lodash minus=runInContext`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus=runInContext'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;
      assert.notOk('runInContext' in lodash, basename);

      start();
    });
  });

  QUnit.test('`lodash minus=value`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus=value'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._;
      assert.ok(lodash() instanceof lodash, basename);
      assert.deepEqual(_.keys(lodash.prototype), [], basename);

      start();
    });
  });

  QUnit.test('`lodash minus=matches`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus=matches'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          iteratee = lodash.iteratee('x'),
          object = { 'x': 1 };

      assert.strictEqual(iteratee(object), 1, basename);

      iteratee = lodash.iteratee(object);
      assert.strictEqual(iteratee(object), object, basename);

      start();
    });
  });

  QUnit.test('`lodash minus=property`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus=property'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          iteratee = lodash.iteratee('x'),
          object = { 'x': 1 };

      assert.strictEqual(iteratee(object), object, basename);

      iteratee = lodash.iteratee(object);
      assert.strictEqual(iteratee(object), true, basename);

      start();
    });
  });

  QUnit.test('`lodash minus=matches,property`', function(assert) {
    var done = assert.async(),
        start = _.after(2, _.once(done));

    build(['minus=matches,property'], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          context = createContext();

      vm.runInContext(data.source, context);

      var lodash = context._,
          iteratee = lodash.iteratee('x'),
          object = { 'x': 1 };

      assert.strictEqual(iteratee(object), object, basename);

      iteratee = lodash.iteratee(object);
      assert.strictEqual(iteratee(object), object, basename);

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
    'exports=iojs',
    'exports=node',
    'exports=none',
    'exports=umd'
  ];

  _.each(commands, function(command, index) {
    var type = command.split('=')[1],
        types = type == 'umd' ? ['amd', 'commonjs', 'global', 'node'] : [type];

    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build([command], function(data) {
        _.each(types, function(type) {
          var basename = path.basename(data.outputPath, '.js'),
              context = createContext(type),
              pass = false,
              source = data.source;

          switch(type) {
            case 'amd':
              context.define = function(factory) {
                pass = true;
                context._ = factory();
              };
              context.define.amd = {};
              vm.runInContext(source, context);

              assert.ok(pass, basename);
              assert.ok(_.isFunction(context._), basename);
              break;

            case 'commonjs':
              vm.runInContext(source, context);
              assert.ok(_.isFunction(context.exports._), basename);
              assert.strictEqual(context._, undefined, basename);
              break;

            case 'global':
              vm.runInContext(source, context);
              assert.ok(_.isFunction(context._), basename);
              break;

            case 'iojs':
            case 'node':
              vm.runInContext(source, context);
              assert.ok(_.isFunction(context.module.exports), basename);
              assert.strictEqual(context._, undefined, basename);
              break;

            case 'none':
              vm.runInContext(source, context);
              assert.strictEqual(context._, undefined, basename);
          }
        });
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
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(['exports=none', command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(func) {
          context.lodash = func();
        };

        try {
          vm.runInContext(data.source, context);
        } catch (e) {
          console.log(e);
        }
        var lodash = context.lodash || {};
        assert.ok(_.isString(lodash.VERSION), basename);

        start();
      });
    });
  });

  QUnit.test('should add `iife` commands to the copyright header', function(assert) {
    var done = assert.async(),
        start = _.once(done),
        command = 'iife=;(function(){/*\r\n*/%output%; root.lodash = _}.call(this))',
        expected = 'iife=";(function(){/*\\r\\n*\\/%output%; root.lodash = _}.call(this))"';

    build([command], function(data) {
      var basename = path.basename(data.outputPath, '.js'),
          comment = _.result(data.source.match(reHeader), 0, '');

      assert.ok(_.includes(comment, expected), basename);

      start();
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('include command');

(function() {
  var commands = [
    'include=chain',
    'include=mixin',
    'include=tap',
    'include=value'
  ];

  _.each(commands, function(command, index) {
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build([command], function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        vm.runInContext(data.source, context);

        var lodash = context._;
        lodash.mixin({ 'x': _.noop });

        assert.strictEqual(lodash.x, _.noop, basename);
        assert.strictEqual(typeof lodash.prototype.x, 'function', basename);
        assert.ok(lodash() instanceof lodash, basename);

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

    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(command.split(' '), function(data) {
        var actualId,
            basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        context.define = function(id, factory) {
          actualId = id;
          context._ = factory();
        };

        context.define.amd = {};
        vm.runInContext(data.source, context);

        assert.strictEqual(actualId, expectedId, basename);
        assert.ok(_.isFunction(context._), basename);

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
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var counter = 0,
          dirs = _.includes(command, 'c.js'),
          done = assert.async(),
          expected = /(\w+)(?=\.js$)/.exec(command)[0];

      var start = _.after(2, _.once(function() {
        if (dirs) {
          fs.rmrfSync(outputPath);
        }
        process.chdir(cwd);
        done();
      }));

      process.chdir(__dirname);

      build(command.split(' '), function(data) {
        var basename = path.basename(data.outputPath, '.js');
        assert.strictEqual(basename, expected + (counter++ ? '.min' : ''), command);
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
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var written,
          done = assert.async(),
          start = _.once(done);

      process.stdout.write = function(string) {
        written = string;
      };

      build(['exports=none', 'include=none'].concat(command.split(' ')), function(data) {
        assert.notOk('outputPath' in data);
        assert.strictEqual(written, data.source);
        assert.strictEqual(arguments.length, 1);

        process.stdout.write = write;
        start();
      });
    });
  });
}());

/*----------------------------------------------------------------------------*/

QUnit.module('lodash build');

(function() {
  var reInclude = /\binclude=/,
      reIncludeValue = /\binclude=(\S*)/,
      reCategory = /\bcategory=/,
      reCategoryValue = /\bcategory=(\S*)/,
      reComma = /, */,
      reMinus = /\bminus=/,
      reMinusValue = /\bminus=(\S*)/,
      rePlus =/\bplus=/,
      rePlusValue = /\bplus=(\S*)/;

  var commands = [
    'strict',
    'category=array',
    'category=chain',
    'category=collection',
    'category=date',
    'category=function',
    'category=lang',
    'category=number',
    'category=object',
    'category=string',
    'category=utility',
    'minus=union,uniq,zip',
    'include=each,filter,map',
    'include=once plus=bind,Chain',
    'category=collection,function',
    'include=defer',
    'strict category=function exports=amd,global plus=pick,uniq',
    'strict include=isArguments,isArray,isFunction,isPlainObject,keys'
  ];

  push.apply(commands, _.map(includes, function(funcName) {
    return 'include=' + funcName;
  }));

  _.each(commands, function(command) {
    QUnit.test('`lodash ' + command +'`', function(assert) {
      var done = assert.async(),
          start = _.after(2, _.once(done));

      build(command.split(' '), function(data) {
        var basename = path.basename(data.outputPath, '.js'),
            context = createContext();

        try {
          vm.runInContext(data.source, context);
        } catch (e) {
          console.log(e);
        }
        // Add function names explicitly.
        if (reInclude.test(command)) {
          var funcNames = command.match(reIncludeValue)[1].split(reComma);
        }
        if (reCategory.test(command)) {
          var categories = command.match(reCategoryValue)[1].split(reComma);
          funcNames || (funcNames = []);
          push.apply(funcNames, _.map(categories, function(category) {
            return getRealCategory(_.capitalize(category.toLowerCase()));
          }));
        }
        if (!funcNames) {
          funcNames = includes.slice();
        }
        if (rePlus.test(command)) {
          var otherNames = command.match(rePlusValue)[1].split(reComma);
          push.apply(funcNames, expandFuncNames(otherNames));
        }
        if (reMinus.test(command)) {
          otherNames = command.match(reMinusValue)[1].split(reComma);
          funcNames = _.difference(funcNames, expandFuncNames(otherNames));
        }
        // Expand categories to function names.
        _.each(funcNames.slice(), function(category) {
          var otherNames = _.filter(mapping.category[category], function(key) {
            var type = typeof _[key];
            return type == 'function' || type == 'undefined';
          });

          // Limit function names to those available for specific builds.
          otherNames = _.intersection(otherNames, includes);

          if (!_.isEmpty(otherNames)) {
            _.pull(funcNames, category);
            push.apply(funcNames, otherNames);
          }
        });

        // Expand aliases and remove nonexistent and duplicate function names.
        funcNames = _.uniq(_.intersection(expandFuncNames(funcNames), includes));

        var lodash = context._ || {};

        _.each(funcNames, function(funcName) {
          testMethod(assert, lodash, funcName, basename);
        });

        start();
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
QUnit.load();
