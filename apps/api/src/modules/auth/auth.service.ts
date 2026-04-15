import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { LoginInput, RegisterInput, ResetPasswordInput } from './auth.schemas.js';

function signToken(user: { id: string; email: string }): string {
  const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'];

  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn,
  });
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new HttpError(409, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const rawRecoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  const recoveryCodeHash = await bcrypt.hash(rawRecoveryCode, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      recoveryCodeHash,
      level: input.level,
      goal: input.goal,
    },
    select: {
      id: true,
      email: true,
      name: true,
      level: true,
      goal: true,
      createdAt: true,
    },
  });

  return {
    token: signToken({ id: user.id, email: user.email }),
    recoveryCode: rawRecoveryCode,
    user,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  return {
    token: signToken({ id: user.id, email: user.email }),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      level: user.level,
      goal: user.goal,
    },
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      level: true,
      goal: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return user;
}

export async function resetPassword(input: ResetPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || (!user.recoveryCodeHash)) {
    throw new HttpError(401, 'Invalid email or recovery code');
  }

  const isValidCode = await bcrypt.compare(input.recoveryCode, user.recoveryCodeHash);
  if (!isValidCode) {
    throw new HttpError(401, 'Invalid email or recovery code');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash,
      recoveryCodeHash: null // Invalidate code after single use to prevent replay attacks
    },
  });
}

export async function regenerateRecoveryCode(userId: string, input: { currentPassword: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new HttpError(401, 'Invalid current password');
  }

  const rawRecoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  const recoveryCodeHash = await bcrypt.hash(rawRecoveryCode, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryCodeHash }
  });

  return rawRecoveryCode;
}
