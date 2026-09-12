// Creates a doctor login account. Run from the project root:
//   node scripts/create-doctor.js "Dr. Full Name" email@example.com
//
// Prompts for a password on the terminal (input is hidden) so it never
// ends up in shell history or a committed file.
require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');
const pool = require('../src/db');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Hide typed characters. This is a minimal terminal trick, not a
    // full password-input library, but it's enough to avoid shoulder-surfing.
    const stdin = process.stdin;
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    stdin.on('data', (char) => {
      char = char + '';
      if (['\n', '\r', '\u0004'].includes(char)) return;
      process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
    });
  });
}

async function main() {
  const [fullName, email] = process.argv.slice(2);
  if (!fullName || !email) {
    console.error('Usage: node scripts/create-doctor.js "Dr. Full Name" email@example.com');
    process.exit(1);
  }

  const password = await promptHidden('Set a password for this account: ');
  console.log('');

  if (password.length < 10) {
    console.error('Password too short -- use at least 10 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      'INSERT INTO doctors (full_name, email, password_hash) VALUES ($1, $2, $3)',
      [fullName, email, hash]
    );
    console.log(`Created doctor account for ${fullName} <${email}>.`);
  } catch (err) {
    if (err.code === '23505') {
      console.error('A doctor with that email already exists.');
    } else {
      console.error('Failed to create account:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
