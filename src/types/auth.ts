export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'USER';
}
