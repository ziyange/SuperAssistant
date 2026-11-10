CREATE TABLE onboarding_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  completed INTEGER NOT NULL CHECK(completed IN (0, 1))
);
