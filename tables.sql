-- Create users table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPZ DEFAULT now()
);

-- Create workout_sessions table
CREATE TABLE workout_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    start_time TIMESTAMPZ NOT NULL,
    end_time TIMESTAMPZ NOT NULL,
    created_at TIMESTAMPZ DEFAULT now()
);

-- Create workout_data table
CREATE TABLE workout_data (
    data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workout_sessions(session_id),
    category TEXT NOT NULL,
    variable_name TEXT NOT NULL,
    value TEXT NOT NULL,
    unit TEXT,
    created_at TIMESTAMPZ DEFAULT now()
);

-- Insert initial users
INSERT INTO users (name) VALUES ('Mike');
INSERT INTO users (name) VALUES ('Patti');
