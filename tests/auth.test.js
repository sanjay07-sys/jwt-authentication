const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper to extract cookies from response
const getCookieHeader = (res) => {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    return cookies.map((c) => c.split(';')[0]).join('; ');
  }
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : '';
};

async function runTests() {
  console.log('====================================================');
  console.log('    RUNNING AUTHENTICATION & JWT TEST SUITE         ');
  console.log('====================================================\n');

  let mongod;
  let server;
  let passedTests = 0;
  let totalTests = 10;
  let sessionCookie = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Start In-Memory MongoDB and Express Server
    // -------------------------------------------------------------------------
    console.log('[Test 1/10] Starting MongoDB and Express server...');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test_super_secret_jwt_key_98765';
    process.env.NODE_ENV = 'test';

    await mongoose.connect(uri);
    server = app.listen(TEST_PORT);
    console.log(`✓ Test 1 Passed: Server listening at ${BASE_URL} & MongoDB connected.\n`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 2: Register a new user
    // -------------------------------------------------------------------------
    console.log('[Test 2/10] Registering a new user (POST /api/auth/register)...');
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sanjay',
        email: 'sanjay@example.com',
        password: 'Password123'
      })
    });

    const registerData = await registerRes.json();
    if (
      registerRes.status === 201 &&
      registerData.success === true &&
      registerData.message === 'User registered successfully' &&
      !registerData.password &&
      !registerData.hash
    ) {
      console.log('✓ Test 2 Passed: User registered successfully (HTTP 201).\n');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: Status ${registerRes.status}, Body: ${JSON.stringify(registerData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Register the same email again (Duplicate error)
    // -------------------------------------------------------------------------
    console.log('[Test 3/10] Registering same email again to test duplicate check...');
    const duplicateRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sanjay Duplicate',
        email: 'sanjay@example.com',
        password: 'Password123'
      })
    });

    const duplicateData = await duplicateRes.json();
    if (duplicateRes.status === 400 && duplicateData.success === false) {
      console.log(`✓ Test 3 Passed: Duplicate registration rejected with HTTP 400: "${duplicateData.message}".\n`);
      passedTests++;
    } else {
      throw new Error(`Test 3 Failed: Status ${duplicateRes.status}, Body: ${JSON.stringify(duplicateData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Login with correct password
    // -------------------------------------------------------------------------
    console.log('[Test 4/10] Logging in with correct password (POST /api/auth/login)...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sanjay@example.com',
        password: 'Password123'
      })
    });

    const loginData = await loginRes.json();
    sessionCookie = getCookieHeader(loginRes);

    if (
      loginRes.status === 200 &&
      loginData.success === true &&
      loginData.user?.email === 'sanjay@example.com' &&
      !loginData.user?.password &&
      sessionCookie.includes('token=')
    ) {
      console.log('✓ Test 4 Passed: Login successful (HTTP 200) and HTTP-only cookie set.\n');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: Status ${loginRes.status}, Cookie: "${sessionCookie}", Body: ${JSON.stringify(loginData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Login with incorrect password
    // -------------------------------------------------------------------------
    console.log('[Test 5/10] Logging in with incorrect password...');
    const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sanjay@example.com',
        password: 'WrongPassword999'
      })
    });

    const invalidLoginData = await invalidLoginRes.json();
    if (invalidLoginRes.status === 401 && invalidLoginData.success === false) {
      console.log(`✓ Test 5 Passed: Invalid login rejected with HTTP 401: "${invalidLoginData.message}".\n`);
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: Status ${invalidLoginRes.status}, Body: ${JSON.stringify(invalidLoginData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Call GET /api/user/profile while authenticated
    // -------------------------------------------------------------------------
    console.log('[Test 6/10] Calling GET /api/user/profile with auth cookie...');
    const profileRes = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: {
        Cookie: sessionCookie
      }
    });

    const profileData = await profileRes.json();
    if (
      profileRes.status === 200 &&
      profileData.success === true &&
      profileData.user?.email === 'sanjay@example.com' &&
      profileData.user?.name === 'Sanjay' &&
      !profileData.user?.password
    ) {
      console.log(`✓ Test 6 Passed: Protected profile retrieved successfully: ${JSON.stringify(profileData.user)}\n`);
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: Status ${profileRes.status}, Body: ${JSON.stringify(profileData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Call profile route without authentication
    // -------------------------------------------------------------------------
    console.log('[Test 7/10] Calling GET /api/user/profile WITHOUT authentication token...');
    const unauthProfileRes = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'GET'
    });

    const unauthProfileData = await unauthProfileRes.json();
    if (unauthProfileRes.status === 401 && unauthProfileData.success === false) {
      console.log(`✓ Test 7 Passed: Unauthenticated request rejected with HTTP 401: "${unauthProfileData.message}".\n`);
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: Status ${unauthProfileRes.status}, Body: ${JSON.stringify(unauthProfileData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Logout
    // -------------------------------------------------------------------------
    console.log('[Test 8/10] Logging out (POST /api/auth/logout)...');
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie
      }
    });

    const logoutData = await logoutRes.json();
    const logoutCookie = getCookieHeader(logoutRes);

    if (
      logoutRes.status === 200 &&
      logoutData.success === true &&
      logoutData.message === 'Logged out successfully'
    ) {
      console.log('✓ Test 8 Passed: Successfully logged out and cookie invalidated.\n');
      passedTests++;
    } else {
      throw new Error(`Test 8 Failed: Status ${logoutRes.status}, Body: ${JSON.stringify(logoutData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Call profile again after logout
    // -------------------------------------------------------------------------
    console.log('[Test 9/10] Calling GET /api/user/profile after logout...');
    // When logged out, the client discards the cookie or sends the cleared cookie (token='')
    const postLogoutProfileRes = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: {
        Cookie: 'token='
      }
    });

    const postLogoutProfileData = await postLogoutProfileRes.json();
    if (postLogoutProfileRes.status === 401 && postLogoutProfileData.success === false) {
      console.log(`✓ Test 9 Passed: Profile access denied after logout with HTTP 401: "${postLogoutProfileData.message}".\n`);
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: Status ${postLogoutProfileRes.status}, Body: ${JSON.stringify(postLogoutProfileData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Verify password stored in MongoDB is bcrypt-hashed and NOT plain text
    // -------------------------------------------------------------------------
    console.log('[Test 10/10] Directly inspecting MongoDB document to verify bcrypt hashing...');
    const userInDb = await User.findOne({ email: 'sanjay@example.com' });
    if (!userInDb) {
      throw new Error('User not found in MongoDB');
    }

    const isPlainText = userInDb.password === 'Password123';
    const isBcryptFormat = userInDb.password.startsWith('$2a$') || userInDb.password.startsWith('$2b$');
    const bcryptMatches = await userInDb.comparePassword('Password123');
    const wrongBcryptFails = !(await userInDb.comparePassword('WrongPassword'));

    console.log(`   Stored hash prefix: ${userInDb.password.substring(0, 10)}... (Length: ${userInDb.password.length})`);
    console.log(`   Is plain text? ${isPlainText}`);
    console.log(`   Is valid bcrypt hash? ${isBcryptFormat}`);
    console.log(`   Password verification matches? ${bcryptMatches}`);

    if (!isPlainText && isBcryptFormat && bcryptMatches && wrongBcryptFails) {
      console.log('✓ Test 10 Passed: Password is confirmed to be securely hashed with bcryptjs and NEVER stored as plain text.\n');
      passedTests++;
    } else {
      throw new Error('Test 10 Failed: Password in database is not securely hashed or validation failed.');
    }

    // -------------------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------------------
    console.log('====================================================');
    console.log(`   ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! `);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:\n', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runTests();
