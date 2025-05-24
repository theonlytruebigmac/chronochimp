const sqlite3 = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

async function testRegistration() {
  try {
    console.log('Opening database...');
    const db = new sqlite3(path.join(process.cwd(), '.data', 'chrono.db'));
    
    // Test 1: Clean up any test users
    console.log('\nCleaning up test users...');
    db.prepare('DELETE FROM users WHERE email LIKE ?').run('test-%@example.com');
    
    // Test 2: Count users before registration
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    console.log('\nInitial user count:', initialCount);
    
    // Test 3: Attempt to register a new user
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'test-password-123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const testName = 'Test User';
    
    console.log('\nAttempting to register user:', testEmail);
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password, role, joinedDate, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = stmt.run(
      Date.now().toString(), // simple ID for test
      testName,
      testEmail,
      hashedPassword,
      initialCount === 0 ? 'Admin' : 'Viewer',
      now,
      now
    );
    
    console.log('Registration result:', {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    });
    
    // Test 4: Verify the user was created
    const newUser = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(testEmail);
    console.log('\nNewly created user:', newUser);
    
    // Test 5: Verify role assignment logic
    console.log('\nRole assignment:', {
      wasFirstUser: initialCount === 0,
      assignedRole: newUser.role,
      expected: initialCount === 0 ? 'Admin' : 'Viewer'
    });
    
    // Test 6: Try to register same email (should fail)
    try {
      stmt.run(
        Date.now().toString(),
        testName,
        testEmail, // same email
        hashedPassword,
        'Viewer',
        now,
        now
      );
      console.log('\n❌ Duplicate email constraint test failed - should have thrown error');
    } catch (error) {
      console.log('\n✅ Duplicate email constraint working:', error.message.includes('UNIQUE'));
    }
    
    // Test 7: Verify final count
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    console.log('\nFinal user count:', finalCount, '(Expected:', initialCount + 1, ')');
    
    db.close();
    console.log('\nRegistration tests completed successfully!');
  } catch (error) {
    console.error('Registration test failed:', error);
  }
}

testRegistration().catch(console.error);
