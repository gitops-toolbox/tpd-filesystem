const tap = require('tap');
const fs = require('fs');
const { TpdFilesystem } = require('../lib');
const valid_config = require('./fixtures/valid.json');

tap.test('When instatiating a new TpdFilesystem object', (t) => {
  t.plan(8);

  t.beforeEach((t) => {
    t.context.tpdFilesystem = new TpdFilesystem(
      './test/fixtures/destination',
      () => {}
    );
    t.context.tpdFilesystem._ask_confirmations = function () {};
    fs.mkdirSync('./test/fixtures/destination');
  });

  t.afterEach((t) => {
    fs.rmSync('./test/fixtures/destination', { recursive: true, force: true });
  });

  t.test('An instance of TpdFilesystem should be returned', (t) => {
    t.plan(1);
    t.type(t.context.tpdFilesystem, TpdFilesystem);
  });

  t.test('Should have a validate method', (t) => {
    t.plan(1);
    t.type(t.context.tpdFilesystem.filterInvalid, 'function');
  });

  t.test('Should have a persist method', (t) => {
    t.plan(1);
    t.type(t.context.tpdFilesystem.persist, 'function');
  });

  t.test('give a valid input should return an empty list', (t) => {
    t.plan(1);
    t.equal(t.context.tpdFilesystem.filterInvalid(valid_config).length, 0);
  });

  t.test(
    'given an invalid input should return the invalid config in a list',
    (t) => {
      t.plan(1);
      t.equal(
        t.context.tpdFilesystem.filterInvalid(
          require('./fixtures/invalid.json')
        ).length,
        7
      );
    }
  );

  t.test('Will create files only if base dir exists', async (t) => {
    t.plan(2);
    await t.context.tpdFilesystem.persist(
      require('./fixtures/create_files.json')
    );
    t.notOk(fs.existsSync('./test/fixtures/destination/nonExistent'));
    t.ok(fs.existsSync('./test/fixtures/destination/existingDir/text.txt'));
  });

  t.test('Will delete files if the file exist', async (t) => {
    t.plan(1);
    await t.context.tpdFilesystem.persist(
      require('./fixtures/create_files.json')
    );
    await t.context.tpdFilesystem.persist(
      require('./fixtures/delete_files.json')
    );
    t.notOk(fs.existsSync('./test/fixtures/destination/existingDir/text.txt'));
  });

  t.test('Will update file if the file exist', async (t) => {
    t.plan(2);
    await t.context.tpdFilesystem.persist(
      require('./fixtures/create_files.json')
    );
    await t.context.tpdFilesystem.persist(
      require('./fixtures/update_files.json')
    );
    t.ok(fs.existsSync('./test/fixtures/destination/existingDir/text.txt'));
    t.equal(
      'test123',
      fs.readFileSync('./test/fixtures/destination/existingDir/text.txt', {
        encoding: 'utf8',
      })
    );
  });
});
