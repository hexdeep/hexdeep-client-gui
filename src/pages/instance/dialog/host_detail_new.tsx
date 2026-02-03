


import { deviceApi } from "@/api/device_api";
import { HostDetailInfo, HostInfo, SDKImagesRes } from "@/api/device_define";
import { Tools } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { Row } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { SwitchSDKDialog } from "./switch_sdk";
import { SwitchDiskDialog } from "./switch_disk";
import { CleanGarbageDialog } from "./clean_garbage_dialog";
import { SetSwapDialog } from "./set_swap";

@Dialog
export class HostDetailDialog extends CommonDialog<HostInfo, void> {
    protected detail: HostDetailInfo = {} as HostDetailInfo;
    protected sdk?: SDKImagesRes;
    protected model: string = "";
    protected firmwareIsLatest: boolean = false;
    protected timer: any;
    override width: string = "600px";
    public override async show(data: HostInfo) {
        this.data = data;
        this.title = this.$t("instance.hostDetail").toString();
        deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        deviceApi.getWarehousingInfo(data.address).then(e => this.model = e.model).catch(e => console.log(e));
        deviceApi.getSDKImages(data.address).then(e => this.sdk = e);
        deviceApi.checkFirmware(data.address).then(e => this.firmwareIsLatest = e);
        this.timer = setInterval(() => {
            deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        }, 1000);
        return super.show(data);
    }

    protected destroyed() {
        clearInterval(this.timer);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderDialog(): VNode {
        return (
            <el-descriptions size="medium" column={1} border labelStyle={{ "width": "120px" }} style={{ padding: "20px" }}>
                <el-descriptions-item label={i18n.t("vmDetail.sdkVersion")}>
                    <Row crossAlign="center">
                        <div style={{ "flex": 1 }}>{this.sdk?.current_version}</div>
                        <Row gap={10}>
                            <MyButton type="primary" size="small" onClick={this.rebootSDK}>{this.$t("vmDetail.rebootSDK")}</MyButton>
                            <MyButton type="primary" size="small" onClick={this.switchSDK}>{this.$t("instance.switchSDK")}</MyButton>
                        </Row>
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.apiGitCommitId")}>
                    <Row crossAlign="center">
                        <div style={{ "flex": 1 }}>{this.detail?.git_commit_id}/{this.sdk?.git_commit_id}</div>
                        <MyButton
                            type="primary"
                            size="small"
                            onClick={this.updateFirmware}
                            disabled={this.firmwareIsLatest}
                        >
                            {this.$t("vmDetail.updateFirmware")}
                            {"(" + (this.firmwareIsLatest ? this.$t("create.already_latest") : this.$t("create.need_update")) + ")"}
                        </MyButton>
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("create.model_id")}>
                    <Row crossAlign="center">
                        {this.model ? `${this.model} (${this.data.address})` : this.data.address}
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.id")}>
                    {this.data.device_id}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.cpu")}>
                    <el-progress text-inside={true} percentage={this.getPercent(this.detail?.cpu)} stroke-width={26}
                        status={this.getStatus(this.detail?.cpu)}></el-progress>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.mem")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.mem_percent)}
                            stroke-width={26} status={this.getStatus(this.detail?.mem_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.mem_total || 0) * this.getPercent(this.detail?.mem_percent) / 100)} / {Tools.getFileSize(this.detail?.mem_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.harddisk") + (this.detail.disk ? "(" + this.detail.disk + ")" : "")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.disk_percent)}
                            stroke-width={26} status={this.getStatus(this.detail?.disk_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.disk_total || 0) * this.getPercent(this.detail?.disk_percent) / 100)} / {Tools.getFileSize(this.detail?.disk_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.swap")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.swap_percent)} stroke-width={26} status={this.getStatus(this.detail?.swap_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.swap_total || 0) * this.getPercent(this.detail?.swap_percent) / 100)} / {Tools.getFileSize(this.detail?.swap_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.temperature")}>
                    {this.detail?.temperature} ℃
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.hostOperate")}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",      // ✅ 允许自动换行
                            gap: "10px 10px",      // 行间距 + 列间距
                            alignItems: "center",
                        }}
                    >
                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}   // ❗按钮内不换行
                            onClick={this.rebootHost}
                        >
                            {this.$t("vmDetail.rebootHost")}
                        </MyButton>



                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.switchDisk}
                        >
                            {this.$t("vmDetail.switchDisk")}
                        </MyButton>

                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.cleanupGarbage}
                        >
                            {this.$t("vmDetail.cleanupGarbage")}
                        </MyButton>

                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.setSwap}
                        >
                            {this.$t("vmDetail.setSwap")}
                        </MyButton>

                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.resetHost}
                        >
                            {this.$t("vmDetail.resetHost")}
                        </MyButton>
                    </div>
                </el-descriptions-item>
            </el-descriptions>
        );
    }

    @ErrorProxy({ success: i18n.t("vmDetail.rebootSDKSuccess"), loading: i18n.t("loading") })
    private async rebootSDK() {
        await deviceApi.rebootSDK(this.data.address);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.rebootHostConfirm"), success: i18n.t("vmDetail.rebootHostSuccess"), loading: i18n.t("loading") })
    private async rebootHost() {
        await deviceApi.rebootHost(this.data.address);
    }



    private async switchDisk() {
        await this.$dialog(SwitchDiskDialog).show(this.data);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.cleanGarbageConfirm") })
    private async cleanupGarbage() {
        await this.$dialog(CleanGarbageDialog).show(this.data);
    }

    private async setSwap() {
        await this.$dialog(SetSwapDialog).show(this.data);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.updateFirmwareConfirm"), success: i18n.t("vmDetail.updateFirmwareSuccess"), loading: i18n.t("loading") })
    private async updateFirmware() {
        await deviceApi.updateFirmware(this.data.address);
        deviceApi.checkFirmware(this.data.address).then(e => this.firmwareIsLatest = e);
    }

    @ErrorProxy({ success: i18n.t("vmDetail.pruneImagesSuccess"), loading: i18n.t("loading") })
    private async pruneImages() {
        await deviceApi.pruneImages(this.data.address);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.resetConfirm"), success: i18n.t("vmDetail.resetSuccess"), loading: i18n.t("loading") })
    private async resetHost() {
        await deviceApi.resetHost(this.data.address);
    }

    private async switchSDK() {
        await this.$dialog(SwitchSDKDialog).show(this.data);
        deviceApi.getSDKImages(this.data.address).then(e => this.sdk = e);
    }

    private getStatus(percent: string | undefined): string | undefined {
        var re = this.getPercent(percent);
        if (re <= 30) {
            return "success";
        } else if (re <= 60) {
            return undefined;
        } else if (re <= 90) {
            return "warning";

        } else {
            return "exception";
        }
    }
    private getPercent(percent: string | undefined): number {
        if (percent) {
            return parseFloat(percent);
        } else {
            return 0.0;
        }
    }
}
