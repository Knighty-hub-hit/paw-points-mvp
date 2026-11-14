import type {NextConfig} from 'next';
const config:NextConfig={...(process.env.GITHUB_PAGES==='true'?{output:'export' as const}:{}),trailingSlash:true,env:{NEXT_PUBLIC_BASE_PATH:process.env.GITHUB_PAGES==='true'?'/paw-points-mvp':''},basePath:process.env.GITHUB_PAGES==='true'?'/paw-points-mvp':''};export default config;
