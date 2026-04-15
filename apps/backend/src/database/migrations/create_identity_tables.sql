-- Create identity_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS identity_documents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_url TEXT NOT NULL,
  document_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PENDING',
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_identity_user_id ON identity_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_status ON identity_documents(status);
CREATE INDEX IF NOT EXISTS idx_identity_created ON identity_documents(created_at);
