const fs = require('fs');
const path = require('path');

describe('Check presence of specific email in backend scripts', () => {
  const repoScriptsDir = path.join(__dirname, '..', 'scripts');
  const targetEmail = 'utsavparmar161@gmail.com';

  function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(filePath));
      } else {
        results.push(filePath);
      }
    });
    return results;
  }

  test('email appears in at least one script under backend/scripts', () => {
    expect(fs.existsSync(repoScriptsDir)).toBe(true);

    const files = walk(repoScriptsDir).filter(f => f.endsWith('.js'));
    const matches = files.filter(f => {
      const content = fs.readFileSync(f, 'utf8');
      return content.includes(targetEmail);
    });

    // Ensure we found at least one script containing the email
    expect(matches.length).toBeGreaterThan(0);

    // For clarity, log matched filenames (Jest will show this only on failure/verbose)
    // console.log('Matched files:', matches);
  });
});
