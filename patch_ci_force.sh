#!/bin/bash
cat << 'PATCH' > ci_force.patch
--- .github/workflows/ci.yml
+++ .github/workflows/ci.yml
@@ -21,7 +21,7 @@
           cache: "npm"

       - name: Install dependencies
-        run: npm install --no-frozen-lockfile
+        run: npm install --force --no-frozen-lockfile

       - name: Run quick Node validation
         run: npm run test:fast
@@ -82,7 +82,7 @@
           pip install -r myai/requirements.txt

       - name: Install Node deps & build
-        run: npm install --no-frozen-lockfile && npm run build
+        run: npm install --force --no-frozen-lockfile && npm run build
       - name: PythonShell tests
         run: node --loader ts-node/esm --test test/python_shell.test.ts
         env:
@@ -103,7 +103,7 @@
           cache: "npm"

       - name: Install dependencies
-        run: npm install --no-frozen-lockfile
+        run: npm install --force --no-frozen-lockfile

       - name: Run linter
         run: npm run lint
@@ -130,7 +130,7 @@
           cache: "npm"

       - name: Install dependencies
-        run: npm ci
+        run: npm install --force --no-frozen-lockfile

       - name: Prepare test DB & run migrations
         shell: bash
PATCH
patch -p0 < ci_force.patch
