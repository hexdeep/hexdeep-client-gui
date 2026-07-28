// 临时预览入口：验证移除文件名/命令列、加时长显示、加重启二次确认后的渲染效果。
// deviceApi 全部打桩，不需要真的 host_server。验证完就删掉，不要提交。
import "@/common/NumberExtends";
import "@/lib/object-extends";
import 'element-ui/lib/theme-chalk/index.css';
import Vue from "vue";
import { i18n } from "./i18n/i18n";
import './install_eleui';
import { DialogPlugin } from "./lib/dialog/dialog";
import "@/tailwind.css";
import "@/styles/app.module.less";
import { deviceApi } from "./api/device_api";
import { StartupDialog } from "./pages/instance/dialog/startup_dialog";
import { StartupInfo } from "./api/device_define";

Vue.use(DialogPlugin);

const now = Date.now();
let items: StartupInfo[] = [
    {
        id: 1, name: "frpc 隧道", filename: "frpc", command: "", resolved_command: "./frpc",
        pid: 12345, started_at: now - 3 * 86400_000 - 5 * 3600_000, running: true, created_at: "2026-07-25 09:00:00",
    },
    {
        id: 2, name: "metrics-agent", filename: "agent", command: "./agent --port 9100",
        resolved_command: "./agent --port 9100", pid: 0, started_at: 0, running: false, created_at: "2026-07-28 09:30:00",
    },
    {
        id: 3, name: "刚启动的进程", filename: "x", command: "", resolved_command: "./x",
        pid: 555, started_at: now - 42_000, running: true, created_at: "2026-07-28 10:00:00",
    },
];

const api = deviceApi as any;
api.getStartups = async () => items;
api.startStartup = async (_ip: string, id: number) => {
    items = items.map(i => i.id === id ? { ...i, running: true, pid: 4242, started_at: Date.now() } : i);
};
api.stopStartup = async (_ip: string, id: number) => {
    items = items.map(i => i.id === id ? { ...i, running: false, pid: 0, started_at: 0 } : i);
};
api.restartStartup = async (_ip: string, id: number) => {
    items = items.map(i => i.id === id ? { ...i, running: true, pid: 5555, started_at: Date.now() } : i);
};
api.deleteStartups = async (_ip: string, ids: number[]) => {
    items = items.filter(i => !ids.includes(i.id));
    return {};
};
api.getStartupLogs = async () => "log line 1\nlog line 2\n";
api.updateStartup = async () => ({});
api.addStartup = (_ip: string, params: any) => ({
    promise: (async () => {
        const item: StartupInfo = {
            id: items.length + 1, name: params.name, filename: params.file.name,
            command: params.command ?? "", resolved_command: params.command || `./${params.file.name}`,
            pid: params.start ? 6666 : 0, started_at: params.start ? Date.now() : 0, running: !!params.start,
            created_at: "2026-07-28 10:00:00",
        };
        items = [...items, item];
        return item;
    })(),
    cancel: () => { },
});

const root = new Vue({ i18n, render: h => h("div") }).$mount("#app");
(window as any).openStartupDialog = () => {
    (root as any).$dialog(StartupDialog).show({
        address: "127.0.0.1", device_id: "e302b553deadbeef", remark: "A1",
    });
};
(window as any).openStartupDialog();
