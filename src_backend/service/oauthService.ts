import { db } from "../data-source";
import { usersTable, userAuthMethodsTable, userGroupsTable, groupsTable } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { JwtPayload } from "./authService";

export interface OAuthUserInfo {
  email: string;
  name: string;
  providerId: string;
  picture?: string;
}

const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
};

const findOrCreateUser = async (
  provider: string,
  userInfo: OAuthUserInfo,
): Promise<{ id: number; email: string; token: string }> => {
  const existingAuth = await db
    .select()
    .from(userAuthMethodsTable)
    .where(
      and(
        eq(userAuthMethodsTable.provider, provider),
        eq(userAuthMethodsTable.providerId, userInfo.providerId),
      ),
    );

  if (existingAuth.length > 0) {
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, existingAuth[0].userId))
      .then((rows) => rows[0]);

    if (user && !user.deletedAt) {
      const payload: JwtPayload = { userId: user.id, email: user.email };
      return { id: user.id, email: user.email, token: generateToken(payload) };
    }
  }

  const existingUser = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, userInfo.email), isNull(usersTable.deletedAt)));

  if (existingUser.length > 0) {
    const user = existingUser[0];
    await db.insert(userAuthMethodsTable).values({
      userId: user.id,
      provider,
      providerId: userInfo.providerId,
      verified: true,
    });

    await db
      .update(usersTable)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const payload: JwtPayload = { userId: user.id, email: user.email };
    return { id: user.id, email: user.email, token: generateToken(payload) };
  }

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(usersTable)
      .values({
        email: userInfo.email,
        name: userInfo.name,
        authProvider: provider,
        providerId: userInfo.providerId,
        emailVerifiedAt: new Date(),
      })
      .returning();

    await tx.insert(userAuthMethodsTable).values({
      userId: user.id,
      provider,
      providerId: userInfo.providerId,
      verified: true,
    });

    const defaultGroup = await tx
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.name, "users"));

    if (defaultGroup.length > 0) {
      await tx.insert(userGroupsTable).values({
        userId: user.id,
        groupId: defaultGroup[0].id,
      });
    }

    return user;
  });

  const payload: JwtPayload = { userId: result.id, email: result.email };
  return { id: result.id, email: result.email, token: generateToken(payload) };
};

const getGoogleAuthUrl = (): string => {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${config.backendUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const exchangeGoogleCode = async (code: string): Promise<OAuthUserInfo> => {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: `${config.backendUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google code");
  }

  const tokenData = await tokenResponse.json() as { access_token: string };

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  const userData = await userResponse.json() as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };

  return {
    email: userData.email,
    name: userData.name,
    providerId: userData.id,
    picture: userData.picture,
  };
};

const getGithubAuthUrl = (): string => {
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: `${config.backendUrl}/api/auth/github/callback`,
    scope: "user:email",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

const exchangeGithubCode = async (code: string): Promise<OAuthUserInfo> => {
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      redirect_uri: `${config.backendUrl}/api/auth/github/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange GitHub code");
  }

  const tokenData = await tokenResponse.json() as { access_token: string };

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch GitHub user info");
  }

  const userData = await userResponse.json() as {
    id: number;
    name: string | null;
    email: string | null;
    login: string;
  };

  let email = userData.email;
  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean }>;
      const primary = emails.find((e) => e.primary);
      email = primary?.email ?? emails[0]?.email ?? "";
    }
  }

  if (!email) {
    throw new Error("GitHub user has no email");
  }

  return {
    email,
    name: userData.name ?? userData.login,
    providerId: String(userData.id),
  };
};

export const oauthService = {
  findOrCreateUser,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGithubAuthUrl,
  exchangeGithubCode,
};
