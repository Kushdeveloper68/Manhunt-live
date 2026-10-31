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

class ApiService {
  private token: string | null = null;

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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Network request failed');
    }

    return data as T;
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

  async googleAuth(data: { googleId: string; email: string; username?: string; avatarId?: string }): Promise<{ token: string; user: UserProfile }> {
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
