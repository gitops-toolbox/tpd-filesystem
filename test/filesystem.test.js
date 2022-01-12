const tap = require('tap');
const fs = require('fs');
const os = require('os');
const sinon = require('sinon');
const path = require('path');
const debug = require('debug')('tpd-filesystem');
const promptsStub = sinon.stub();
const { TpdFilesystem } = tap.mock('../lib', {
  prompts: async (values) => {
    promptsStub(values);
  },
});
const valid_config = require('./fixtures/valid.json');

const logger = debug;

tap.test('When instantiating a new TpdFilesystem object', (t) => {
  t.plan(7);

  t.beforeEach((t) => {
    t.context.original_log = console.log;
    console.log = debug;
    t.context.args = {
      baseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tpd-filesystem-')),
      interactive: false,
    };
  });

  t.afterEach((t) => {
    console.log = t.context.original_log;
    fs.rmSync(t.context.args.baseDir, { recursive: true, force: true });
  });

  t.test('give a valid input should return an empty list', (t) => {
    t.plan(1);
    t.equal(
      new TpdFilesystem(valid_config, logger, t.context.args).filterInvalid()
        .length,
      0
    );
  });

  t.test(
    'given an invalid input should return the invalid config in a list',
    async (t) => {
      t.plan(1);
      const fixture = require('./fixtures/invalid.json');
      const result = await new TpdFilesystem(
        fixture,
        logger,
        t.context.args
      ).persist();
      t.equal(result.invalidTemplates.length, 7);
    }
  );

  t.test(
    'should be invalid only when renderedTemplate is null or undefined',
    async (t) => {
      t.plan(3);
      const fixtures = require('./fixtures/valid.json');
      const fixture = Object.assign({}, fixtures[0], { template: 'notNull' });
      const tpdFilesystem = new TpdFilesystem([], logger, t.context.args);
      const emptyString = Object.assign({}, fixture, { renderedTemplate: '' });
      const isNull = Object.assign({}, fixture, { renderedTemplate: null });
      const isUndefined = Object.assign({}, fixture, {
        renderedTemplate: undefined,
      });

      t.equal(tpdFilesystem.isValid(emptyString), true);
      t.equal(tpdFilesystem.isValid(isNull), false);
      t.equal(tpdFilesystem.isValid(isUndefined), false);
    }
  );

  t.test('Will create files only if base dir exists', async (t) => {
    t.plan(3);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();
    t.notOk(fs.existsSync(path.join(t.context.args.baseDir, 'nonExistent')));
    t.ok(
      fs.existsSync(path.join(t.context.args.baseDir, 'existingDir/text.txt'))
    );
    t.ok(
      fs.existsSync(
        path.join(
          t.context.args.baseDir,
          'deep/folder/multiple/levels/text.txt'
        )
      )
    );
  });

  // t.test('Will esclude invalid templates when persisting', async (t) => {});

  t.test('Will delete files if the file exist', async (t) => {
    t.plan(1);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();
    await new TpdFilesystem(
      require('./fixtures/delete_files.json'),
      logger,
      t.context.args
    ).persist();
    t.notOk(
      fs.existsSync(
        path.resolve(t.context.args.baseDir, '/existingDir/text.txt')
      )
    );
  });

  t.test('Will update file if the file exist', async (t) => {
    t.plan(2);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();
    await new TpdFilesystem(
      require('./fixtures/update_files.json'),
      logger,
      t.context.args
    ).persist();
    t.ok(
      fs.existsSync(path.join(t.context.args.baseDir, 'existingDir/text.txt'))
    );
    t.equal(
      'test123',
      fs.readFileSync(
        path.join(t.context.args.baseDir, 'existingDir/text.txt'),
        {
          encoding: 'utf8',
        }
      )
    );
  });

  t.test('Will prompt if interactive is true', async (t) => {
    t.plan(1);

    await new TpdFilesystem(require('./fixtures/create_files.json'), logger, {
      ...t.context.args,
      interactive: true,
    }).persist();

    t.ok(
      promptsStub.calledWith({
        type: 'text',
        name: 'continue',
        message: 'Press any key to continue, CRTL^C to stop',
      })
    );
  });
});
