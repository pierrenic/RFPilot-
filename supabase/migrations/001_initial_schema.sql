-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations (multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_test BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (users can belong to multiple orgs)
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
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

-- Corpus (reusable document collections per org)
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
  themes JSONB DEFAULT '[]'::jsonb,
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

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_corpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE brick_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's org IDs
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies

-- Organizations: users see only their orgs
CREATE POLICY "Users can view their orgs" ON organizations
  FOR SELECT USING (id IN (SELECT user_org_ids()));

-- Profiles: users see profiles in their orgs
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view org members profiles" ON profiles
  FOR SELECT USING (id IN (
    SELECT user_id FROM org_members WHERE org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Org members: users see members of their orgs
CREATE POLICY "Users can view org members" ON org_members
  FOR SELECT USING (org_id IN (SELECT user_org_ids()));

-- Org admins can manage members
CREATE POLICY "Admins can insert org members" ON org_members
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete org members" ON org_members
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Projects: org isolation
CREATE POLICY "Users can view org projects" ON projects
  FOR SELECT USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "Users can create org projects" ON projects
  FOR INSERT WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY "Users can update org projects" ON projects
  FOR UPDATE USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "Users can delete org projects" ON projects
  FOR DELETE USING (org_id IN (SELECT user_org_ids()));

-- Corpus: org isolation
CREATE POLICY "Users can view org corpus" ON corpus
  FOR SELECT USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "Users can manage org corpus" ON corpus
  FOR ALL USING (org_id IN (SELECT user_org_ids()));

-- Corpus documents: via corpus org
CREATE POLICY "Users can view corpus docs" ON corpus_documents
  FOR SELECT USING (corpus_id IN (
    SELECT id FROM corpus WHERE org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can manage corpus docs" ON corpus_documents
  FOR ALL USING (corpus_id IN (
    SELECT id FROM corpus WHERE org_id IN (SELECT user_org_ids())
  ));

-- Document chunks: via corpus
CREATE POLICY "Users can view chunks" ON document_chunks
  FOR SELECT USING (corpus_document_id IN (
    SELECT cd.id FROM corpus_documents cd
    JOIN corpus c ON cd.corpus_id = c.id
    WHERE c.org_id IN (SELECT user_org_ids())
  ));

-- Corpus slides/assets: via corpus
CREATE POLICY "Users can view slides" ON corpus_slides
  FOR SELECT USING (corpus_document_id IN (
    SELECT cd.id FROM corpus_documents cd
    JOIN corpus c ON cd.corpus_id = c.id
    WHERE c.org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can view assets" ON corpus_assets
  FOR SELECT USING (corpus_document_id IN (
    SELECT cd.id FROM corpus_documents cd
    JOIN corpus c ON cd.corpus_id = c.id
    WHERE c.org_id IN (SELECT user_org_ids())
  ));

-- Bricks: via project
CREATE POLICY "Users can view bricks" ON bricks
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can manage bricks" ON bricks
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

-- Project members: via project
CREATE POLICY "Users can view project members" ON project_members
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

-- Brick assignments: via brick/project
CREATE POLICY "Users can view assignments" ON brick_assignments
  FOR SELECT USING (brick_id IN (
    SELECT b.id FROM bricks b
    JOIN projects p ON b.project_id = p.id
    WHERE p.org_id IN (SELECT user_org_ids())
  ));

-- Activities: via project
CREATE POLICY "Users can view activities" ON activities
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can create activities" ON activities
  FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

-- Project corpus: via project
CREATE POLICY "Users can view project corpus links" ON project_corpus
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

CREATE POLICY "Users can manage project corpus links" ON project_corpus
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT user_org_ids())
  ));

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

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
