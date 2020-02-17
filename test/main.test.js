require('jest');
const path = require('path');
const stream = require('stream');
const File = require('vinyl');
const gulp = require('gulp');
const header = require('../');

const streamToString = stream =>
  new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    } catch (err) {
      reject(err);
    }
  });

describe('gulp-header', () => {
  let fakeFile;

  const getFakeFile = (fileContent, data) => {
    const result = new File({
      path: './test/fixture/file.txt',
      cwd: './test/',
      base: './test/fixture/',
      contents: Buffer.from(fileContent || ''),
    });
    if (data !== undefined) {
      result.data = data;
    }
    return result;
  };

  const getFakeFileReadStream = () => {
    const s = new stream.Readable({ objectMode: true });
    s._read = () => {};
    s.push('Hello world');
    s.push(null);
    return new File({
      contents: s,
      path: './test/fixture/anotherFile.txt',
    });
  };

  beforeEach(() => {
    fakeFile = getFakeFile('Hello world');
  });

  describe('header', () => {
    it('file should pass through', done => {
      expect.assertions(8);

      let file_count = 0;
      const stream = header();
      stream.on('data', newFile => {
        expect(newFile).toBeDefined();
        expect(newFile.path).toBeDefined();
        expect(newFile.relative).toBeDefined();
        expect(newFile.contents).toBeDefined();
        expect(newFile.path).toBe('test/fixture/file.txt'.split('/').join(path.sep));
        expect(newFile.relative).toBe('file.txt');
        expect(newFile.contents.toString('utf8')).toBe('Hello world');
        ++file_count;
      });

      stream.once('end', () => {
        expect(file_count).toBe(1);
        done();
      });

      stream.write(fakeFile);
      stream.end();
    });

    it('should prepend the header to the file content', done => {
      expect.assertions(3);

      const myHeader = header('And then i said : ');

      myHeader.write(fakeFile);

      myHeader.once('data', file => {
        expect(file.isBuffer()).toBeTruthy();
        expect(file.contents).toBeDefined();
        expect(file.contents.toString('utf8')).toBe('And then i said : Hello world');
        done();
      });
      myHeader.end();
    });

    it('should prepend the header to the file content (stream)', done => {
      expect.assertions(2);

      const myHeader = header('And then i said : ');

      myHeader.write(getFakeFileReadStream());

      myHeader.once('data', async file => {
        expect(file.isStream()).toBeTruthy();
        const result = await streamToString(file.contents);
        expect(result).toBe('And then i said : Hello world');
        done();
      });
      myHeader.end();
    });

    it('should format the header', done => {
      expect.assertions(2);

      const stream = header('And then <%= foo %> said : ', { foo: 'you' });
      //const stream = header('And then ${foo} said : ', { foo : 'you' } );
      stream.on('data', newFile => {
        expect(newFile.contents).toBeDefined();
        expect(newFile.contents.toString('utf8')).toBe('And then you said : Hello world');
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should format the header (ES6 delimiters)', done => {
      expect.assertions(2);

      const stream = header('And then ${foo} said : ', { foo: 'you' });
      stream.on('data', newFile => {
        expect(newFile.contents).toBeDefined();
        expect(newFile.contents.toString('utf8')).toBe('And then you said : Hello world');
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should access to the current file', done => {
      expect.assertions(2);

      const expectedContents = 'file.txt\ntest/fixture/file.txt\nHello world'
        .split('/')
        .join(path.sep);
      const stream = header(['<%= file.relative %>', '<%= file.path %>', ''].join('\n'));
      stream.on('data', newFile => {
        expect(newFile.contents).toBeDefined();
        expect(newFile.contents.toString('utf8')).toBe(expectedContents);
      });
      stream.once('end', done);

      stream.write(fakeFile);
      stream.end();
    });

    it('should access the data of the current file', done => {
      expect.assertions(2);

      const stream = header('<%= license %>\n');
      stream.on('data', newFile => {
        expect(newFile.contents).toBeDefined();
        expect(newFile.contents.toString('utf8')).toBe('WTFPL\nHello world');
      });
      stream.once('end', done);

      stream.write(getFakeFile('Hello world', { license: 'WTFPL' }));
      stream.end();
    });

    it('multiple files should pass through', done => {
      expect.assertions(3);

      const headerText = 'use strict;',
        stream = gulp.src('./test/fixture/*.txt').pipe(header(headerText)),
        files = [];

      stream.on('error', done);
      stream.on('data', file => {
        expect(file.contents.toString('utf8')).toMatch(/^use strict;/);
        files.push(file);
      });
      stream.on('end', () => {
        expect(files.length).toBe(2);
        done();
      });
    });

    it('no files are acceptable', done => {
      expect.assertions(1);
      const headerText = 'use strict;',
        stream = gulp.src('./test/fixture/*.html').pipe(header(headerText)),
        files = [];

      stream.on('error', done);
      stream.on('data', file => {
        files.push(file);
      });
      stream.on('end', () => {
        expect(files.length).toBe(0);
        done();
      });
    });
  });
});
