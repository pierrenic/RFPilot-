-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  org_id UUID REFERENCES organizations(id),
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (one per RFP/tender)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'review', 'completed')),
  source_file_url TEXT,
  source_file_name TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corpus (reusable document collections)
CREATE TABLE corpus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link projects to corpus
CREATE TABLE project_corpus (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  corpus_id UUID REFERENCES corpus(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, corpus_id)
);

-- Corpus documents
CREATE TABLE corpus_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_id UUID REFERENCES corpus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  has_slides BOOLEAN DEFAULT FALSE,
  has_images BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks for RAG
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_document_id UUID REFERENCES corpus_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding dimension
  page_number INTEGER,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Corpus slides (for presentations)
CREATE TABLE corpus_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_document_id UUID REFERENCES corpus_documents(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL,
  thumbnail_url TEXT,
  content_text TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corpus assets (images/graphics)
CREATE TABLE corpus_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_document_id UUID REFERENCES corpus_documents(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bricks (individual questions/requirements from RFP)
CREATE TABLE bricks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  title TEXT,
  tag TEXT DEFAULT 'other' CHECK (tag IN ('technique', 'juridique', 'financier', 'commercial', 'references', 'admin', 'other')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'review', 'validated')),
  current_assignee_id UUID REFERENCES profiles(id),
  response_text TEXT,
  ai_response_text TEXT,
  ai_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'writer' CHECK (role IN ('owner', 'writer', 'reviewer', 'validator')),
  themes JSONB DEFAULT '[]'::jsonb, -- array of tags this member handles
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Brick assignments (who handles what)
CREATE TABLE brick_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brick_id UUID REFERENCES bricks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('writer', 'reviewer', 'validator')),
  theme_tag TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  brick_id UUID REFERENCES bricks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'edited', 'submitted', 'approved', 'rejected', 'exported', 'ai_generated')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE brick_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (users can access their org's data)
CREATE POLICY "Users can view their org" ON organizations
  FOR SELECT USING (id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their org projects" ON projects
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their org corpus" ON corpus
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bricks_updated_at
  BEFORE UPDATE ON bricks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
