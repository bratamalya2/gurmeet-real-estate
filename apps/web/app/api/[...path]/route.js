export const dynamic = 'force-dynamic';

async function handler(request, context) {
  const params = await context.params;
  const pathArray = params?.path || [];
  const subPath = Array.isArray(pathArray) ? pathArray.join('/') : pathArray;
  
  const internalApi = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const apiBase = internalApi.replace(/\/api\/?$/, '');
  
  const url = new URL(request.url);
  const targetUrl = `${apiBase}/api/${subPath}${url.search}`;
  
  const headers = new Headers(request.headers);
  headers.delete('host');
  
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }
  
  try {
    const res = await fetch(targetUrl, init);
    const responseHeaders = new Headers(res.headers);
    
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(JSON.stringify({ error: 'Backend API unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
