export interface GeneratedUser {
  username: string;
  email: string;
  password: string;
  runId: string;
  environment: string;
  createdAt: string;
}

export interface ConduitUser {
  email: string;
  username: string;
  bio: string | null;
  image: string;
  token?: string;
}

export interface RegisteredUser extends GeneratedUser {
  token: string;
  bio?: string | null;
  image?: string;
}

export interface AuthResponse {
  email: string;
  username: string;
  bio: string | null;
  image: string;
  token: string;
}

export interface UserAuthResponse {
  user: AuthResponse;
}

export interface CurrentUserResponse {
  user: ConduitUser;
}

export interface GenerateUserOverrides {
  username?: string;
  email?: string;
  password?: string;
}

export interface CreateUserPayload {
  user: {
    email: string;
    password: string;
    username: string;
  };
}
