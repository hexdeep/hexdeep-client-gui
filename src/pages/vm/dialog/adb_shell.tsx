import { DeviceInfo } from "@/api/device_define";
import { getSuffixName, makeVmWsApiUrl } from "@/common/common";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { MyButton } from "@/lib/my_button";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { VNode } from "vue";
import { Ref } from "vue-property-decorator";
import { FilelistDialog } from "./filelist";

/** 前端发往后端的 resize 控制帧，与 super_sdk adb_handler.go 的 resizeMsg 对应 */
interface ResizeMsg {
    type: "resize";
    cols: number;
    rows: number;
}

/** 隐藏功能：在预览图上连续双击弹出的交互式 adb shell 终端，对接 super_sdk 的 /and_api/shell_ws */
@Dialog
export class AdbShellDialog extends CommonDialog<DeviceInfo, void> {
    public override width = "1100px";
    public override height = "560px";
    public override allowEscape: boolean = false;

    @Ref() private termRef!: HTMLDivElement;

    private term?: Terminal;
    private fitAddon?: FitAddon;
    private ws?: WebSocket;
    private resizeObserver?: ResizeObserver;

    public override show(data: DeviceInfo) {
        this.title = `ADB Shell ${data.hostIp}(${data.index}-${getSuffixName(data.name)})`;
        return super.show(data);
    }

    protected mounted() {
        const term = new Terminal({
            cursorBlink: true,
            convertEol: true,
            fontSize: 13,
            scrollback: 200000,
            theme: { background: "#1e1e1e" },
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(this.termRef);
        fitAddon.fit();
        term.focus();
        this.term = term;
        this.fitAddon = fitAddon;

        term.onData((data) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(new TextEncoder().encode(data));
            }
        });
        term.onResize(({ cols, rows }) => this.sendResize(cols, rows));

        this.resizeObserver = new ResizeObserver(() => this.fitAddon?.fit());
        this.resizeObserver.observe(this.termRef);

        this.connect();
    }

    protected beforeDestroy() {
        this.resizeObserver?.disconnect();
        this.ws?.close();
        this.term?.dispose();
    }

    private openFilelist() {
        this.$dialog(FilelistDialog).show(this.data);
    }

    private connect() {
        const url = makeVmWsApiUrl("and_api/shell_ws", this.data.hostIp, this.data.name);
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        this.ws = ws;

        ws.onopen = () => {
            if (this.term) this.sendResize(this.term.cols, this.term.rows);
        };
        ws.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
                this.term?.write(new Uint8Array(ev.data));
            } else if (typeof ev.data === "string") {
                this.term?.write(ev.data);
            }
        };
        ws.onerror = () => {
            this.term?.writeln("\r\n\x1b[31m[连接出错]\x1b[0m");
        };
        ws.onclose = () => {
            this.term?.writeln("\r\n\x1b[33m[连接已断开]\x1b[0m");
        };
    }

    private sendResize(cols: number, rows: number) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const msg: ResizeMsg = { type: "resize", cols, rows };
            this.ws.send(JSON.stringify(msg));
        }
    }

    protected override renderHeader() {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
                <MyButton class="ms-auto" text={this.$t("upload.fileBrowser")} onClick={() => this.openFilelist()} />
                <div class="dialog-close el-icon-close" style={{ marginLeft: "10px" }} onClick={() => this.close()} />
            </div>
        );
    }

    protected override renderFooter() {
        // 终端弹窗不需要确认/取消按钮
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ height: "100%", padding: "10px", boxSizing: "border-box", background: "#1e1e1e" }}>
                <div ref="termRef" style={{ width: "100%", height: "100%" }} />
            </div>
        );
    }
}
