// 添加环境变量的类型提示
interface ImportMetaEnv {
  VITE_APP_HOSTNAME: string;
  VITE_APP_BASEURL: string;
  VITE_APP_OAUTHURL: string;
  VITE_APP_WSURL: string;
  VITE_APP_MEDIAURL: string;
  VITE_APP_SSOURL: string;
  VITE_APP_TITLE: string;
  VITE_APP_CLIENTID: string;
  VITE_APP_CLIENTSECRET: string;
  VITE_APP_ALLOW_VIDEO: string;
}
declare var ENV: ImportMetaEnv;