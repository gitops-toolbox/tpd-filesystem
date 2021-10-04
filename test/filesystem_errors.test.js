const tap = require('tap');
const fs = require('fs');
const os = require('os');
const path = require('path');
const prompts = require('prompts');
const sinon = require('sinon');
const debug = require('debug')('tpd-filesystem');
const { TpdFilesystem } = require('../lib');

const logger = debug;

tap.test('TpdFilesystem return error if', (t) => {
  t.plan(5);

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
    sinon.restore();
    fs.rmSync(t.context.args.baseDir, { recursive: true, force: true });
  });

  t.test('Cannot create intermediatery folder', async (t) => {
    t.plan(1);
    sinon.replace(
      fs,
      'mkdirSync',
      sinon.fake.throws('Failed to create folder')
    );
    const result = await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();

    t.strictSame(result, {
      deleted: [],
      failed_to_delete: [],
      created: [],
      failed_to_create: [
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'existingDir/text.txt'
          ),
          message: 'Failed to create folder',
        },
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'deep/folder/multiple/levels/text.txt'
          ),
          message: 'Failed to create folder',
        },
      ],
      updated: [],
      failed_to_update: [],
      rejected: [path.resolve(t.context.args.baseDir, 'nonExistent/file1.txt')],
    });
  });

  t.test('Cannot create a file', async (t) => {
    t.plan(1);
    sinon.replace(
      fs,
      'writeFileSync',
      sinon.fake.throws('Failed to write file')
    );
    const result = await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();

    t.strictSame(result, {
      deleted: [],
      failed_to_delete: [],
      created: [],
      failed_to_create: [
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'existingDir/text.txt'
          ),
          message: 'Failed to write file',
        },
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'deep/folder/multiple/levels/text.txt'
          ),
          message: 'Failed to write file',
        },
      ],
      updated: [],
      failed_to_update: [],
      rejected: [path.resolve(t.context.args.baseDir, 'nonExistent/file1.txt')],
    });
  });

  t.test('Cannot update a file', async (t) => {
    t.plan(1);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();

    sinon.replace(
      fs,
      'writeFileSync',
      sinon.fake.throws('Failed to write file')
    );

    const result = await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();

    t.strictSame(result, {
      deleted: [],
      failed_to_delete: [],
      created: [],
      failed_to_create: [],
      updated: [],
      failed_to_update: [
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'existingDir/text.txt'
          ),
          message: 'Failed to write file',
        },
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'deep/folder/multiple/levels/text.txt'
          ),
          message: 'Failed to write file',
        },
      ],
      rejected: [path.resolve(t.context.args.baseDir, 'nonExistent/file1.txt')],
    });
  });

  t.test('Cannot delete files', async (t) => {
    t.plan(1);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      t.context.args
    ).persist();
    sinon.replace(fs, 'unlinkSync', sinon.fake.throws('Failed to delete file'));
    const result = await new TpdFilesystem(
      require('./fixtures/delete_files.json'),
      logger,
      t.context.args
    ).persist();

    t.strictSame(result, {
      deleted: [],
      failed_to_delete: [
        {
          destination: path.resolve(
            t.context.args.baseDir,
            'existingDir/text.txt'
          ),
          message: 'Failed to delete file',
        },
      ],
      created: [],
      failed_to_create: [],
      updated: [],
      failed_to_update: [],
      rejected: [],
    });
  });

  t.test('users press CTRL^C on prompt', async (t) => {
    t.plan(1);
    sinon.stub(process, 'exit');
    prompts.inject([new Error('CTRL^C')]);
    await new TpdFilesystem(
      [
        {
          template: 'test.txt',
          destination: {
            type: 'tpd-filesystem',
            params: {
              baseDir: '.',
              filepath: 'existingDir/text.txt',
            },
          },
          renderedTemplate: 'test',
        },
      ],
      logger,
      {
        ...t.context.args,
        interactive: true,
      }
    ).persist();

    t.ok(process.exit.calledWith(1));
  });
});
