CREATE TABLE IF NOT EXISTS drift_routes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  city TEXT NOT NULL DEFAULT '',
  route JSONB NOT NULL,
  verified BOOLEAN DEFAULT false,
  times_run INTEGER DEFAULT 0,
  avg_adherence REAL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drift_runs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id TEXT REFERENCES drift_routes(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  distance_meters REAL NOT NULL,
  trace JSONB NOT NULL,
  route_polyline JSONB,
  analysis_id TEXT,
  generation_log_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drift_run_analysis (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES drift_runs(id) ON DELETE CASCADE,
  route_id TEXT REFERENCES drift_routes(id) ON DELETE SET NULL,
  start_coord REAL[],
  adherence REAL NOT NULL,
  deviation_zones JSONB NOT NULL DEFAULT '[]',
  completion REAL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drift_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_run_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own routes" ON drift_routes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own runs" ON drift_runs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own analyses" ON drift_run_analysis
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_drift_routes_user ON drift_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_drift_runs_user ON drift_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_drift_runs_route ON drift_runs(route_id);
CREATE INDEX IF NOT EXISTS idx_drift_analysis_run ON drift_run_analysis(run_id);
CREATE INDEX IF NOT EXISTS idx_drift_analysis_route ON drift_run_analysis(route_id);
