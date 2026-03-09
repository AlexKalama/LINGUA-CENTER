-- Supabase Schema for Lingua Center Management System

-- 1. Programs Table
CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Courses Table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  program_type TEXT REFERENCES programs(id) ON DELETE CASCADE,
  levels TEXT[] NOT NULL,
  level_fees JSONB NOT NULL, -- Map level name to numeric fee OR structured fee items
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Teachers Table
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  id_number TEXT,
  courses TEXT[], -- Array of course names or IDs
  active BOOLEAN DEFAULT true,
  stats JSONB DEFAULT '{"totalStudents": 0, "graduates": 0, "dropouts": 0, "activeClasses": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  identification JSONB, -- {type, number}
  next_of_kin JSONB, -- {name, phone}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enrollments Table
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  program_type TEXT REFERENCES programs(id),
  course_id UUID REFERENCES courses(id),
  course_name TEXT NOT NULL,
  level TEXT NOT NULL,
  teacher_id UUID REFERENCES teachers(id),
  teacher_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('ACTIVE', 'GRADUATED', 'DROPOUT')) DEFAULT 'ACTIVE',
  fee_balance NUMERIC NOT NULL DEFAULT 0,
  total_fee NUMERIC NOT NULL DEFAULT 0,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  payment_status TEXT CHECK (payment_status IN ('PAID', 'PARTIAL', 'PENDING')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Payments Table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  reference TEXT,
  method TEXT CHECK (method IN ('MPESA', 'BANK', 'CASH')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Profiles (for Auth integration)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT CHECK (role IN ('ADMIN', 'TEACHER')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simplified for demo - in production, refine these)
CREATE POLICY "Public read access for programs" ON programs FOR SELECT USING (true);
CREATE POLICY "Public read access for courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage everything" ON programs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON courses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON teachers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON students FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON enrollments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage everything" ON attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- Insert Initial Programs
INSERT INTO programs (id, label, icon_name, color) VALUES
('LANGUAGE', 'Languages', 'Languages', 'text-navy'),
('COMPUTER', 'Computer Science', 'Monitor', 'text-sage'),
('DRIVING', 'Driving School', 'Car', 'text-warning-muted'),
('ACCOUNTING', 'Accounting', 'Calculator', 'text-success-muted');
