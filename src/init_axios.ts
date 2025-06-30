// import axios from 'axios';
// import { accountState } from './state/account';
// import { Config } from './common/Config';

// export function initAxios() {
//     if (window['$http']) return;
//     if (process.env.NODE_ENV == "development") console.log('initAxios');
//     let http = axios.create({ timeout: 10000 });
//     http.interceptors.request.use((httpConfig) => {
//         if (!httpConfig.headers.Accept) httpConfig.headers.Accept = 'application/json';
//         httpConfig.headers['Access-Control-Allow-Origin'] = '*';
//         let sid = httpConfig.headers['X-API-SERVICE'];
//         if (!isHttp(httpConfig.url!)) {
//             if (sid == 'auth') {
//                 httpConfig.baseURL = Config.apiAuthUrl;
//             } else {
//                 httpConfig.baseURL = Config.apiBaseUrl;
//             }
//         }

//         if (accountState.isLogin) httpConfig.headers.Authorization = `Bearer ${accountState.auth.accessToken}`;
//         delete httpConfig.headers['X-API-SERVICE'];
//         return httpConfig;
//     });
//     window['$http'] = http;
// }
// function isHttp(url: string) {
//     var re = new RegExp("^(http|https)://", "i");
//     return re.test(url);
// }