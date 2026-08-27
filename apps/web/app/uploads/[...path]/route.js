export const dynamic = 'force-dynamic';

async function handler(request, context) {
  const params = await context.params;
  const pathArray = params?.path || [];
  const subPath = Array.isArray(pathArray) ? pathArray.join('/') : pathArray;
  
  const internalApi = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const apiBase = internalApi.replace(/\/api\/?$/, '');
  
  const targetUrl = `${apiBase}/uploads/${subPath}`;
  
  try {
    const res = await fetch(targetUrl);
    const responseHeaders = new Headers(res.headers);
    
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Uploads proxy error:', error);
    return new Response(null, { status: 404 });
  }
}

export const GET = handler;
export const HEAD = handler;
