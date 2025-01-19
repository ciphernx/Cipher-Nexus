import { createClient } from 'redis';
import { getConfig } from '../utils/config';

const config = getConfig();

export const redisClient = createClient({
  url: 
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};

export const disconnectRedis = async (): Promise<void> => {
  await redisClient.disconnect();
};
