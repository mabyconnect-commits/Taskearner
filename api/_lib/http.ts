// Framework-agnostic request/response contract shared by the Vercel function
// entrypoint and the local Express dev server.
export interface ApiRequest {
  method: string;
  path: string; // e.g. "/auth/login" (already stripped of the /api prefix)
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

export interface ApiResponse {
  status: number;
  body: any;
  text?: string; // when set, respond as text/plain (e.g. NEKpay callback "success")
  headers?: Record<string, string>;
}

export function ok(body: any, status = 200): ApiResponse {
  return { status, body };
}

export function err(message: string, status = 400): ApiResponse {
  return { status, body: { error: message } };
}

export function textResp(text: string, status = 200): ApiResponse {
  return { status, body: null, text };
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
