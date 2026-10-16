/** Select the larger M3 JSON parser by route and content type only. */
export function isContentJsonRequest(request:{originalUrl?:string;url?:string;headers:{'content-type'?:string|string[]}}):boolean{
 const path=(request.originalUrl??request.url??'').split('?',1)[0],type=request.headers['content-type'];
 return /^\/api\/tenants\/[a-f0-9-]{36}\/(?:content|site-builder)(?:\/|$)/.test(path)&&typeof type==='string'&&/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type);
}
