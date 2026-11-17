/** Isolated sandbox deployment: runtime SDK aliases cannot contact Firebase. */
const nextConfig = {
 serverExternalPackages: ["firebase-admin"],
 turbopack: {resolveAlias: {"firebase/auth":"./app/sandbox/auth.ts","firebase/firestore":"./app/sandbox/firestore.ts"}},
 async headers(){return [{source:"/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"},{key:"Content-Security-Policy",value:"connect-src 'self' https://tile.openstreetmap.org; worker-src 'self' blob:; form-action 'self'; object-src 'none'; base-uri 'self'"}]}];}
};
module.exports=nextConfig;
