import { Pool } from 'pg';
import { getConfig } from '../utils/config';

const config = getConfig();

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password
});

export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
};
