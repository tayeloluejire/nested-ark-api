import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'infrastructure_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  // Initialize pool client outside try block for proper scoping in catch
  const client = await pool.connect();

  try {
    console.log('Connecting to database...');
    console.log('Connected!');

    // Find schema file
    const possiblePaths = [
      path.resolve(__dirname, '../../database-schema.sql'),
      path.resolve(__dirname, '../../../database-schema.sql'),
      path.resolve(__dirname, '../../../../database-schema.sql'),
      path.resolve(__dirname, '../../../../../database-schema.sql'),
      path.join(process.cwd(), 'database-schema.sql'),
    ];

    // FIX: Explicitly define types to allow null assignment
    let schemaPath: string | null = null;
    let schema: string | null = null;

    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        schemaPath = tryPath;
        schema = fs.readFileSync(tryPath, 'utf-8');
        break;
      }
    }

    // Use a type guard or check to satisfy TS that schema is a string before proceeding
    if (!schema || !schemaPath) {
      throw new Error(`database-schema.sql not found. Tried: ${possiblePaths.join(', ')}`);
    }

    console.log('Reading schema from:', schemaPath);
    
    // Step 1: Drop all views first (they depend on tables)
    console.log('Dropping existing views...');
    try {
      await client.query('DROP VIEW IF EXISTS v_contractor_performance CASCADE');
      await client.query('DROP VIEW IF EXISTS v_escrow_balance CASCADE');
      await client.query('DROP VIEW IF EXISTS v_project_summary CASCADE');
    } catch (e) {
      // Ignore errors if views don't exist
    }

    // Step 2: Drop all tables in correct order (respecting foreign keys)
    console.log('Dropping existing tables...');
    const tablesToDrop = [
      'settlement_distributions',
      'settlement_rules',
      'settlements',
      'investor_contracts',
      'investor_returns',
      'investments',
      'payment_holds',
      'escrow_transactions',
      'escrow_wallets',
      'disputes',
      'milestone_approvals',
      'milestone_evidence',
      'milestones',
      'contracts',
      'bids',
      'contractor_ratings',
      'contractors',
      'project_documents',
      'projects',
      'compliance_documents',
      'transaction_logs',
      'audit_logs',
      'notifications',
      'contractor_metrics',
      'project_metrics',
      'platform_config',
      'sessions',
      'user_profiles',
      'users',
    ];

    for (const table of tablesToDrop) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch (e) {
        // Ignore errors
      }
    }

    console.log('Creating fresh schema...');
    
    // Step 3: Execute the schema SQL
    // TypeScript now knows schema is a string because of the throw check above
    const statements = schema
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
        process.stdout.write(`\r[${i + 1}/${statements.length}] Executing migrations...`);
      } catch (error: any) {
        console.error(`\nError in statement ${i + 1}:`, error.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
      }
    }

    console.log('\n✓ Database migrations completed successfully!');
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Migration failed:', error.message);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

runMigrations();