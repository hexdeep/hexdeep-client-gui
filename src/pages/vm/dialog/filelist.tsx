import { deviceApi } from '@/api/device_api';
import { DeviceInfo, FilelistInfo, } from '@/api/device_define';
import { makeVmApiUrl, Tools } from '@/common/common';
import { i18n } from '@/i18n/i18n';
import { Column, Row } from "@/lib/container";
import { Dialog, DrawerDialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from '@/lib/error_handle';
import { MyButton, TextButton } from "@/lib/my_button";
import * as p from "path";
import { VNode } from "vue";
import { Watch } from "vue-property-decorator";

@Dialog
export class FilelistDialog extends DrawerDialog<DeviceInfo, void> {
    private files: FilelistInfo[] = [];
    private delayShowLoadingTimer: any;
    private isLoading: boolean = false;
    private currentDir = "/sdcard";

    @Watch("currentDir")
    private async ls() {
        if (this.delayShowLoadingTimer) {
            clearTimeout(this.delayShowLoadingTimer);
        }
        this.delayShowLoadingTimer = setTimeout(() => {
            this.isLoading = true;
        }, 500);
        try {
            this.files = [];
            const files = await deviceApi.getFilelist(this.data.hostIp, this.data.name, this.currentDir);
            files && files.sort((f1, f2) => {
                if (!f1.flag && f2.flag)
                    return 1;
                else if (f1.flag && !f2.flag)
                    return -1;
                else
                    return 0;
            });
            this.files = files;
        } catch (error) {
            this.$alert(`${error}`, this.$t("upload.loadFailed").toString());
            console.warn(error);
        } finally {
            this.isLoading = false;
            clearTimeout(this.delayShowLoadingTimer);
            if (this.currentDir !== "/") {
                this.files.insert({
                    file: "..",
                    flag: true,
                    name: "..",
                    length: 0
                });
            }
        }
    }

    public override show(data: DeviceInfo) {
        this.data = data;
        this.title = this.$t("upload.fileBrowser").toString();
        this.ls();
        return super.show(data);
    }

    private goto(dir: string) {
        if (dir.includes("..")) {
            dir = p.normalize(dir).replaceAll("\\", "/");
        }
        console.log(dir);
        this.currentDir = dir;
    }

    // @ErrorProxy({ success: i18n.t("success") })
    // private async download(row: FilelistInfo) {
    //     const url = makeVmApiUrl("and_api/down_file", this.data.hostIp, this.data.name) + `?path=${row.file}`;
    //     window.open(url);
    // }

    private renderBreadcrumb() {
        const breadcrumb = this.currentDir.substring(1).split("/").filter(item => item);
        let path = "";
        return (
            <Row style={{ flex: 1 }}>
                <TextButton onClick={() => this.goto("/")}>root</TextButton>/
                {breadcrumb.map(item => {
                    let p = path = path + `/${item}`;
                    return <TextButton title={p} onClick={() => this.goto(p)}>{item}</TextButton>;
                }).joinElement("/")}
            </Row>
        );
    }

    private renderActionSlot({ row }: { row: FilelistInfo; }) {
        const url = makeVmApiUrl("and_api/down_file", this.data.hostIp, this.data.name) + `?path=${row.file}`;
        return (
            <Row>
                {!row.flag && <a href={url} class={"link"} download={row.name}>{this.$t("upload.download")}</a>}
            </Row>
        );
    }

    private async selectFile() {
        var re = await Tools.popFileSelector("*.*");
        if (re) this.upload(re);
    }

    @ErrorProxy({ success: i18n.t("upload.success"), loading: i18n.t("loading") })
    private async upload(file: File) {
        await deviceApi.upload(this.data.hostIp, this.data.name, `${this.currentDir}/${file.name}`, file);

        await this.ls();
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={10} style={{ margin: 0, padding: "10px", backgroundColor: "#fff" }}>
                <Row crossAlign="center" height={"40px"} padding="10px" gap={10} >
                    {this.renderBreadcrumb()}
                    <MyButton text={this.$t("upload.upload")} onClick={this.selectFile} />
                    <MyButton text={this.$t("upload.refresh")} onClick={this.ls} />
                </Row>
                <el-table empty-text=" " v-loading={this.isLoading} data={this.files} style="width: 100%" height="100%">
                    <el-table-column prop="filename" label={this.$t("upload.filename")} show-overflow-tooltip formatter={this.renderFilename} />
                    <el-table-column prop="length" label={this.$t("upload.size")} width="100" formatter={r => !r.flag && Tools.getFileSize(r.length)} />
                    <el-table-column label={this.$t("action")} width="100" scopedSlots={{ default: this.renderActionSlot }} />
                </el-table>
            </Column>
        );
    }

    protected override renderFooter() {
        // ignore
    }

    private renderFilename(file: FilelistInfo) {
        if (file.flag) {
            const path = (this.currentDir == "/" ? "" : this.currentDir) + "/" + file.name;
            return (
                <TextButton onClick={() => this.goto(path)}>
                    <i class="el-icon-folder"></i>
                    <span style={{ marginLeft: "5px" }}>{file.name}</span>
                </TextButton>
            );
        } else {
            return (
                <span>
                    <i class="el-icon-document"></i>
                    <span style={{ marginLeft: "5px" }}>{file.name}</span>
                </span>
            );
        }
    }
}