.headers on
.mode column
SELECT * FROM todos;

SELECT * FROM todo_deps;

SELECT * FROM todos WHERE status = 'pending' AND id NOT IN (SELECT todo_id FROM todo_deps td JOIN todos t ON td.depends_on = t.id WHERE t.status != 'done');

CREATE TABLE IF NOT EXISTS todo_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id TEXT,
  action TEXT,
  message TEXT,
  created_at TEXT
);

INSERT INTO todo_log (todo_id, action, message, created_at)
VALUES ('smoke','done','Smoke agent reported success and set status to done', datetime('now'));

SELECT * FROM todo_log;
