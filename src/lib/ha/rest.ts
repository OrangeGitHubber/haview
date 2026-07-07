import { haBase } from '../config';

export class HaRestError extends Error {
  /** status 0 means the fetch itself failed — a network/proxy problem */
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HaRestError';
  }

  get isLikelyCors(): boolean {
    return this.status === 0;
  }
}

// requests go same-origin through the container's HA reverse proxy, which
// injects the bearer token — no Authorization header or CORS needed here
export async function haFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(haBase() + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new HaRestError(0, 'Could not reach Home Assistant through the dashboard server.');
  }
  if (!res.ok) {
    throw new HaRestError(res.status, `Home Assistant API returned ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}
