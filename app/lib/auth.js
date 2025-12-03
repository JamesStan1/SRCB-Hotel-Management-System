import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function getSession(req) {
  const token = await getToken({ req });
  if (!token) return null;
  
  return {
    user: {
      id: token.sub,
      name: token.name,
      email: token.email,
      role: token.role,
    }
  };
}
