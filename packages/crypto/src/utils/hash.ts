import crypto from 'crypto';

export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const generateSalt = (length: number = 16): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const hashWithSalt = (data: string, salt: string): string => {
  return crypto.createHmac('sha256', salt).update(data).digest('hex');
};
