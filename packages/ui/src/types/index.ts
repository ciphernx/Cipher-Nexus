export interface Theme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface ProjectConfig {
  id: string;
  name: string;
  privacyLevel: 'basic' | 'medium' | 'high';
  modelConfig: {
    type: string;
    parameters: Record<string, any>;
  };
}
