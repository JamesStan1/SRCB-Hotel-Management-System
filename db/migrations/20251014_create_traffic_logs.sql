-- Table: traffic_logs
CREATE TABLE IF NOT EXISTS traffic_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(100) NOT NULL,
    route TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'allowed', -- e.g., 'allowed', 'throttled', 'blocked'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional index for faster lookups by IP and time
CREATE INDEX IF NOT EXISTS idx_traffic_ip_timestamp
ON traffic_logs (ip_address, created_at DESC);

-- Optional index for route-based monitoring
CREATE INDEX IF NOT EXISTS idx_traffic_route
ON traffic_logs (route);
