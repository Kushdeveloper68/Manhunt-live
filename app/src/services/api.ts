import { UserProfile, GameSettings, GamePlayer } from '@manhunt/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

export interface GameResponse {
  _id: string;
  code: string;
  hostId: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  name: string;
  mode: 'Classic Manhunt' | 'Last Runner Standing';
  settings: GameSettings;
  status: 'lobby' | 'countdown' | 'running' | 'ended';
  players: {
    userId: {
      _id: string;
      username: string;
      avatarId?: string;
      stats?: UserProfile['stats'];
    };
    role: 'CHASER' | 'RUNNER';
    status: 'ACTIVE' | 'TAGGED' | 'ELIMINATED' | 'DISCONNECTED';
    ready: boolean;
  }[];
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type FriendStatus = 'IN_GAME' | 'IN_LOBBY' | 'ONLINE' | 'OFFLINE';
export interface FriendEntry {
  userId: string;
  username: string;
  avatarId: string;
  status: FriendStatus;
  statusDetail?: string;
  lastSeenLabel?: string;
}
export interface FriendRequestEntry {
  requestId: string;
  userId: string;
  username: string;
  avatarId: string;
}
export interface FriendSearchResult {
  userId: string;
  username: string;
  avatarId: string;
  relationship: 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';
  requestId?: string;
}
export interface GameInviteEntry {
  inviteId: string;
  gameId: string;
  code: string;
  gameName: string;
  from: { userId: string; username: string; avatarId: string };
  expiresAt: string;
}

class ApiService {
  private token: string | null = null;
  /** Called when the server says our token is no longer valid. */
  onUnauthorized: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Some endpoints answer 204 No Content
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      if (res.status === 401 && this.token) this.onUnauthorized?.();
      throw new ApiError(data.error || 'Network request failed', res.status);
    }

    return data as T;
  }

  // ───────── Friends ─────────
  async getFriends(): Promise<{ friends: FriendEntry[]; incoming: FriendRequestEntry[]; outgoing: FriendRequestEntry[] }> {
    return this.request('/friends');
  }
  async searchFriends(q: string): Promise<{ results: FriendSearchResult[] }> {
    return this.request(`/friends/search?q=${encodeURIComponent(q)}`);
  }
  async sendFriendRequest(username: string): Promise<{ status: 'REQUESTED' | 'FRIENDS' }> {
    return this.request('/friends/request', { method: 'POST', body: JSON.stringify({ username }) });
  }
  async acceptFriendRequest(requestId: string): Promise<void> {
    await this.request(`/friends/requests/${encodeURIComponent(requestId)}/accept`, { method: 'POST' });
  }
  async declineFriendRequest(requestId: string): Promise<void> {
    await this.request(`/friends/requests/${encodeURIComponent(requestId)}/decline`, { method: 'POST' });
  }
  async cancelFriendRequest(requestId: string): Promise<void> {
    await this.request(`/friends/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
  }
  async removeFriend(userId: string): Promise<void> {
    await this.request(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  }
  async inviteFriend(gameId: string, userId: string): Promise<void> {
    await this.request('/friends/invite', { method: 'POST', body: JSON.stringify({ gameId, userId }) });
  }
  async getInvites(): Promise<{ invites: GameInviteEntry[] }> {
    return this.request('/friends/invites');
  }
  async declineInvite(inviteId: string): Promise<void> {
    await this.request(`/friends/invites/${encodeURIComponent(inviteId)}/decline`, { method: 'POST' });
  }

  // ───────── Account ─────────
  async putPushToken(token: string): Promise<void> {
    await this.request('/auth/push-token', { method: 'PUT', body: JSON.stringify({ token }) });
  }
  async deletePushToken(): Promise<void> {
    await this.request('/auth/push-token', { method: 'DELETE' });
  }
  async deleteAccount(confirmUsername: string): Promise<void> {
    await this.request('/auth/me', { method: 'DELETE', body: JSON.stringify({ confirmUsername }) });
  }

  // Auth Endpoints
  async checkUsername(username: string): Promise<{ available: boolean; username: string; reason?: string }> {
    return this.request(`/auth/check-username?username=${encodeURIComponent(username)}`);
  }

  async register(data: { email: string; password: string; username: string }): Promise<{ token: string; user: UserProfile }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }): Promise<{ token: string; user: UserProfile }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async googleAuth(data: { idToken?: string; googleId?: string; email?: string; username?: string; avatarId?: string }): Promise<{ token: string; user: UserProfile }> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<{ user: UserProfile }> {
    return this.request('/auth/me');
  }

  async updateProfile(data: {
    username?: string;
    avatarId?: string;
    dob?: string;
    emergencyContact?: { name: string; phone: string };
    fcmToken?: string;
  }): Promise<{ user: UserProfile }> {
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Game Endpoints
  async createGame(data: {
    name: string;
    mode: 'Classic Manhunt' | 'Last Runner Standing';
    settings: GameSettings;
  }): Promise<{ game: GameResponse }> {
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGameByCode(code: string): Promise<{ game: GameResponse }> {
    return this.request(`/games/code/${encodeURIComponent(code)}`);
  }

  async getGameById(id: string): Promise<{ game: GameResponse }> {
    return this.request(`/games/${encodeURIComponent(id)}`);
  }

  async getMyGames(): Promise<{ active: GameResponse[]; recent: GameResponse[] }> {
    return this.request('/games/my-games');
  }
}

export const api = new ApiService();
