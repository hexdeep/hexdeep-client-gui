import { DeviceInfo } from "@/api/device_define";
import { getSuffixName, makeVmWsApiUrl } from "@/common/common";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { MyButton } from "@/lib/my_button";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import Vue, { VNode } from "vue";
import { Ref } from "vue-property-decorator";
import { FilelistDialog } from "./filelist";

/** 前端发往后端的 resize 控制帧，与 super_sdk adb_handler.go 的 resizeMsg 对应 */
interface ResizeMsg {
    type: "resize";
    cols: number;
    rows: number;
}

/** 一个 tab 对应一条独立的终端连接 */
interface AdbSession {
    id: number;
    /** 云机标识，同一台云机只保留一个 tab，见 deviceKeyOf */
    deviceKey: string;
    data: DeviceInfo;
    title: string;
    term: Terminal;
    fitAddon: FitAddon;
    container: HTMLDivElement;
    ws?: WebSocket;
}

/** 云机的唯一标识，取与 shell_ws 连接地址一致的字段，保证「同一台云机」的判定和实际连接一致 */
function deviceKeyOf(data: DeviceInfo) {
    return `${data.hostIp}/${data.name}`;
}

let sessionSeq = 0;

/** 全局唯一的终端窗口实例，最小化后依然保留，用于让新连接以 tab 形式加入 */
let instance: AdbShellDialog | undefined;

/**
 * 打开一个终端连接；已存在窗口（含被最小化的）时复用同一个窗口并新增一个 tab。
 *
 * 注意：不能写成 AdbShellDialog 的静态方法。类体内的 `AdbShellDialog` 绑定的是未经
 * `@Dialog` 装饰的原始类，用它 `$dialog()` 出来的实例拿不到 render/computed 等组件选项。
 */
export function openAdbShell(vueCtx: Vue, data: DeviceInfo) {
    if (!instance) instance = vueCtx.$dialog(AdbShellDialog);
    instance.show(data);
}

/** 隐藏功能：在预览图上连续双击弹出的交互式 adb shell 终端，对接 super_sdk 的 /and_api/shell_ws
 *
 * 全局单例：最小化后终端连接不会断开，再次打开时会作为新 tab 加入同一个窗口。
 */
@Dialog
export class AdbShellDialog extends CommonDialog<DeviceInfo, void> {
    public override width = "1100px";
    public override height = "560px";
    public override allowEscape: boolean = false;

    @Ref() private termsWrapper!: HTMLDivElement;

    private sessions: AdbSession[] = [];
    private activeId = 0;
    private resizeObserver?: ResizeObserver;

    private get activeSession() {
        return this.sessions.find((s) => s.id === this.activeId);
    }

    public override show(data: DeviceInfo) {
        const result = super.show(data);
        this.addSession(data);
        return result;
    }

    protected mounted() {
        this.resizeObserver = new ResizeObserver(() => this.activeSession?.fitAddon.fit());
        this.resizeObserver.observe(this.termsWrapper);
    }

    protected beforeDestroy() {
        this.resizeObserver?.disconnect();
        for (const session of this.sessions) this.destroySession(session);
        this.sessions = [];
    }

    protected override onClosed() {
        if (instance === this) instance = undefined;
    }

    private addSession(data: DeviceInfo) {
        // 同一台云机已经开过终端时不再新建连接，直接切回原来的 tab，保留它的历史
        const deviceKey = deviceKeyOf(data);
        const exist = this.sessions.find((s) => s.deviceKey === deviceKey);
        if (exist) {
            this.switchTab(exist.id);
            return;
        }

        const id = ++sessionSeq;
        const title = `${data.hostIp}(${data.index}-${getSuffixName(data.name)})`;

        const container = document.createElement("div");
        container.style.cssText = "width:100%;height:100%;";
        this.termsWrapper.appendChild(container);

        const term = new Terminal({
            cursorBlink: true,
            convertEol: true,
            fontSize: 13,
            scrollback: 200000,
            theme: { background: "#1e1e1e" },
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(container);

        const session: AdbSession = { id, deviceKey, data, title, term, fitAddon, container };
        this.sessions.push(session);
        this.switchTab(id);

        term.onData((d) => {
            if (session.ws?.readyState === WebSocket.OPEN) {
                session.ws.send(new TextEncoder().encode(d));
            }
        });
        term.onResize(({ cols, rows }) => this.sendResize(session, cols, rows));

        this.connect(session);
    }

    private switchTab(id: number) {
        this.activeId = id;
        for (const session of this.sessions) {
            session.container.style.display = session.id === id ? "block" : "none";
        }
        this.$nextTick(() => {
            this.activeSession?.fitAddon.fit();
            this.activeSession?.term.focus();
        });
    }

    private closeTab(id: number, e?: Event) {
        e?.stopPropagation();
        const idx = this.sessions.findIndex((s) => s.id === id);
        if (idx < 0) return;
        const [session] = this.sessions.splice(idx, 1);
        this.destroySession(session);

        if (this.sessions.length === 0) {
            this.close();
            return;
        }
        if (this.activeId === id) {
            const next = this.sessions[Math.max(0, idx - 1)];
            this.switchTab(next.id);
        }
    }

    private destroySession(session: AdbSession) {
        session.ws?.close();
        session.term.dispose();
        session.container.remove();
    }

    private minimize() {
        this.hide();
    }

    /** 点击右上角关闭按钮时二次确认：说明关闭的后果，并建议改用最小化 */
    private async confirmClose() {
        const count = this.sessions.length;
        const detail = count > 1 ? `当前 ${count} 个终端连接都会被断开` : "当前终端连接会被断开";
        const action = await this.$confirm(
            `${detail}，且无法恢复历史记录。如果只是暂时不用，建议点击“最小化”，连接会保留，下次打开可以继续使用。`,
            "关闭 ADB Shell",
            {
                confirmButtonText: "仍要关闭",
                cancelButtonText: "最小化",
                type: "warning",
                distinguishCancelAndClose: true,
            }
        ).catch((a: string) => a);
        if (action === "confirm") {
            this.close();
        } else if (action === "cancel") {
            this.minimize();
        }
    }

    private openFilelist() {
        const session = this.activeSession;
        if (session) this.$dialog(FilelistDialog).show(session.data);
    }

    private connect(session: AdbSession) {
        const url = makeVmWsApiUrl("and_api/shell_ws", session.data.hostIp, session.data.name);
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        session.ws = ws;

        ws.onopen = () => this.sendResize(session, session.term.cols, session.term.rows);
        ws.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
                session.term.write(new Uint8Array(ev.data));
            } else if (typeof ev.data === "string") {
                session.term.write(ev.data);
            }
        };
        ws.onerror = () => {
            session.term.writeln("\r\n\x1b[31m[连接出错]\x1b[0m");
        };
        ws.onclose = () => {
            session.term.writeln("\r\n\x1b[33m[连接已断开]\x1b[0m");
        };
    }

    private sendResize(session: AdbSession, cols: number, rows: number) {
        if (session.ws?.readyState === WebSocket.OPEN) {
            const msg: ResizeMsg = { type: "resize", cols, rows };
            session.ws.send(JSON.stringify(msg));
        }
    }

    protected override renderHeader() {
        const active = this.activeSession;
        return (
            <div class="dialog-header">
                <div class="dialog-title">{active ? `ADB Shell ${active.title}` : "ADB Shell"}</div>
                <MyButton class="ms-auto" text={this.$t("upload.fileBrowser")} onClick={() => this.openFilelist()} />
                <div class="dialog-close el-icon-minus" style={{ marginLeft: "10px" }} onClick={() => this.minimize()} />
                <div class="dialog-close el-icon-close" style={{ marginLeft: "10px" }} onClick={() => this.confirmClose()} />
            </div>
        );
    }

    protected override renderFooter() {
        // 终端弹窗不需要确认/取消按钮
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", background: "#1e1e1e" }}>
                {/* tab 栏与终端容器都必须带 key 且常驻，否则 tab 栏出现/消失时 Vue 会按下标复用
                    终端容器那个 div，把 addSession 手动挂进去的终端 DOM 一起换掉，历史就没了 */}
                <div
                    key="adb-tabbar"
                    style={{
                        display: this.sessions.length > 1 ? "flex" : "none",
                        flexShrink: "0",
                        background: "#252526",
                        borderBottom: "1px solid #000",
                        overflowX: "auto",
                    }}
                >
                    {this.sessions.map((session) => (
                        <div
                            key={session.id}
                            class="adb-tab"
                            onClick={() => this.switchTab(session.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "0 10px",
                                height: "34px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                fontSize: "12px",
                                color: session.id === this.activeId ? "#fff" : "#ffffff99",
                                background: session.id === this.activeId ? "#1e1e1e" : "transparent",
                                borderRight: "1px solid #000",
                            }}
                        >
                            <span>{session.title}</span>
                            <span
                                class="el-icon-close"
                                style={{ fontSize: "12px" }}
                                onClick={(e: Event) => this.closeTab(session.id, e)}
                            />
                        </div>
                    ))}
                </div>
                <div key="adb-terms" style={{ flex: "1", minHeight: "0", padding: "10px", boxSizing: "border-box" }}>
                    <div ref="termsWrapper" style={{ width: "100%", height: "100%", position: "relative" }} />
                </div>
            </div>
        );
    }
}
