const tap = require('tap');
const fs = require('fs');
const path = require('path');
const debug = require('debug')('tpd-filesystem');
const { TpdFilesystem } = require('../lib');
const valid_config = require('./fixtures/valid.json');

const destination_path = './test/fixtures/destination';
const logger = debug;
const args = {
  baseDir: destination_path,
  interactive: false,
};

tap.test('When instatiating a new TpdFilesystem object', (t) => {
  t.plan(5);

  t.beforeEach((t) => {
    t.context.original_log = console.log;
    console.log = debug;
    fs.mkdirSync(destination_path);
  });

  t.afterEach((t) => {
    console.log = t.context.original_log;
    fs.rmSync(destination_path, { recursive: true, force: true });
  });

  t.test('give a valid input should return an empty list', (t) => {
    t.plan(1);
    t.equal(
      new TpdFilesystem(valid_config, logger, args).filterInvalid().length,
      0
    );
  });

  t.test(
    'given an invalid input should return the invalid config in a list',
    (t) => {
      t.plan(1);
      t.equal(
        new TpdFilesystem(
          require('./fixtures/invalid.json'),
          logger,
          args
        ).filterInvalid().length,
        7
      );
    }
  );

  t.test('Will create files only if base dir exists', async (t) => {
    t.plan(3);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      args
    ).persist();
    t.notOk(fs.existsSync(path.join(destination_path, 'nonExistent')));
    t.ok(fs.existsSync(path.join(destination_path, 'existingDir/text.txt')));
    t.ok(
      fs.existsSync(
        path.join(destination_path, 'deep/folder/multiple/levels/text.txt')
      )
    );
  });

  t.test('Will delete files if the file exist', async (t) => {
    t.plan(1);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      args
    ).persist();
    console.log('==================');
    await new TpdFilesystem(
      require('./fixtures/delete_files.json'),
      logger,
      args
    ).persist();
    t.notOk(fs.existsSync('./test/fixtures/destination/existingDir/text.txt'));
  });

  t.test('Will update file if the file exist', async (t) => {
    t.plan(2);
    await new TpdFilesystem(
      require('./fixtures/create_files.json'),
      logger,
      args
    ).persist();
    await new TpdFilesystem(
      require('./fixtures/update_files.json'),
      logger,
      args
    ).persist();
    t.ok(fs.existsSync(path.join(destination_path, 'existingDir/text.txt')));
    t.equal(
      'test123',
      fs.readFileSync(path.join(destination_path, 'existingDir/text.txt'), {
        encoding: 'utf8',
      })
    );
  });
});
