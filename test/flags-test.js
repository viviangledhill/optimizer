'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var util = require('./util');
var outputDir = nodePath.join(__dirname, 'build');

require('app-module-path').addPath(nodePath.join(__dirname, 'src'));
describe('optimizer flags', function() {
    beforeEach(function(done) {
        util.rmdirRecursive(outputDir);
        for (var k in require.cache) {
            if (require.cache.hasOwnProperty(k)) {
                delete require.cache[k];
            }
        }
        require('raptor-promises').enableLongStacks();
        require('raptor-logging').configureLoggers({
            'optimizer': 'WARN',
            'raptor-cache': 'WARN'
        });
        done();
    });
    it('should allow for optimizing a page with flags', function(done) {
        var optimizer = require('../');
        var pageOptimizer = optimizer.create({
            fileWriter: {
                outputDir: outputDir,
                urlPrefix: '/',
                fingerprintsEnabled: false
            },
            flags: ['a'],
            bundlingEnabled: false
        }, __dirname, __filename);
        var writerTracker = require('./WriterTracker').create(pageOptimizer.writer);
        pageOptimizer.optimizePage({
                pageName: 'testPage',
                dependencies: [
                    './optimizer.json'
                ],
                from: nodePath.join(__dirname, 'test-flags-project')
            })
            .then(function(optimizedPage) {

                expect(writerTracker.getOutputFilenames()).to.deep.equal([
                    // a.js only included if "a" flag is enabled
                    'a.js',

                    /* NOTE: b.js should not be included because it requires flag "b" */
                    // 'a.js'

                    // c.js is always included (not conditional)
                    'c.js'
                ]);

                expect(writerTracker.getCodeForFilename('a.js')).to.equal('a=true;');
                expect(writerTracker.getCodeForFilename('c.js')).to.equal('c=true;');
                optimizer.flushAllCaches(done);
            })
            .done();
    });

    it('should allow for optimizing a page with flags and bundles', function(done) {
        var optimizer = require('../');

        var from = nodePath.join(__dirname, 'test-flags-project');
        var pageOptimizer = optimizer.create({
            fileWriter: {
                outputDir: outputDir,
                urlPrefix: '/',
                fingerprintsEnabled: false
            },
            flags: ['a'],
            bundlingEnabled: true,

            bundles: [
                {
                    name: 'foo',
                    dependencies: [
                        './optimizer.json'
                    ]
                }
            ]
        }, from, __filename);
        var writerTracker = require('./WriterTracker').create(pageOptimizer.writer);
        pageOptimizer.optimizePage({
                pageName: 'testPage',
                dependencies: [
                    './c.js'
                ],
                from: from
            })
            .then(function(optimizedPage) {

                expect(writerTracker.getOutputFilenames()).to.deep.equal([
                    'foo.js'
                ]);

                expect(writerTracker.getCodeForFilename('foo.js')).to.equal('a=true;\nc=true;');
                optimizer.flushAllCaches(done);
            })
            .done();
    });

    it('should allow if-not-flag', function(done) {
        var optimizer = require('../');
        var pageOptimizer = optimizer.create({
            fileWriter: {
                outputDir: outputDir,
                urlPrefix: '/',
                fingerprintsEnabled: false
            },
            flags: ['a'],
            bundlingEnabled: false
        }, __dirname, __filename);
        var writerTracker = require('./WriterTracker').create(pageOptimizer.writer);
        pageOptimizer.optimizePage({
                pageName: 'testPage',
                dependencies: [
                    {'type': 'js', 'path': './a.js', 'if-flag': 'a'},
                    {'type': 'js', 'path': './b.js', 'if-not-flag': 'a'}
                ],
                from: nodePath.join(__dirname, 'test-flags-project')
            })
            .then(function(optimizedPage) {

                expect(writerTracker.getOutputFilenames()).to.deep.equal([
                    // a.js only included if "a" flag is enabled
                    'a.js',

                    /* NOTE: b.js should not be included because it will only be included if "a" flag is not enabled */
                    // 'b.js'
                ]);

                expect(writerTracker.getCodeForFilename('a.js')).to.equal('a=true;');
                expect(writerTracker.getCodeForFilename('b.js')).to.equal(undefined);
                optimizer.flushAllCaches(done);
            })
            .done();
    });
});
